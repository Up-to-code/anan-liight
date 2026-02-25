import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { whatsappInboundSchema } from "@api/schema/whatsapp";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { processWhatsAppInbound } from "@modules/reducers/whatsapp-reducer";
import { processWebhookPayload } from "@modules/whatsapp/webhook/service";
import { ROUTE_PATHS, TABLE_NAMES } from "@shared/constants";

export async function registerWhatsAppRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.get(ROUTE_PATHS.WHATSAPP_WEBHOOK, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { [key: string]: string | undefined };
    const challenge = query["hub.challenge"];
    const mode = query["hub.mode"];
    const verifyToken = query["hub.verify_token"];
    if (!challenge || mode !== "subscribe") {
      await runtime.store.insert(TABLE_NAMES.WEBHOOK_EVENT_LOG, {
        id: randomUUID(),
        eventId: randomUUID(),
        provider: "meta",
        eventType: "verification",
        status: "rejected",
        signatureValid: true,
        payloadHash: "",
        errorCode: "INVALID_VERIFICATION_PAYLOAD",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      });
      reply.code(400).send({ error: "Invalid webhook verification payload" });
      return;
    }
    if (runtime.env.WHATSAPP_VERIFY_TOKEN && verifyToken !== runtime.env.WHATSAPP_VERIFY_TOKEN) {
      await runtime.store.insert(TABLE_NAMES.WEBHOOK_EVENT_LOG, {
        id: randomUUID(),
        eventId: randomUUID(),
        provider: "meta",
        eventType: "verification",
        status: "rejected",
        signatureValid: false,
        payloadHash: "",
        errorCode: "VERIFY_TOKEN_MISMATCH",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      });
      reply.code(403).send({ error: "Webhook verify token mismatch" });
      return;
    }
    await runtime.store.insert(TABLE_NAMES.WEBHOOK_EVENT_LOG, {
      id: randomUUID(),
      eventId: randomUUID(),
      provider: "meta",
      eventType: "verification",
      status: "accepted",
      signatureValid: true,
      payloadHash: "",
      errorCode: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    });
    reply.code(200).send(challenge);
  });

  app.post(ROUTE_PATHS.WHATSAPP_WEBHOOK, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!runtime.env.FEATURE_LLIGHT_WA_WEBHOOK_ENABLED) {
      await runtime.store.insert(TABLE_NAMES.WEBHOOK_EVENT_LOG, {
        id: randomUUID(),
        eventId: randomUUID(),
        provider: "meta",
        eventType: "message",
        status: "disabled",
        signatureValid: false,
        payloadHash: "",
        errorCode: "WEBHOOK_DISABLED",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      });
      reply.code(404).send({ error: "Not available" });
      return;
    }

    const parsed = whatsappInboundSchema.safeParse(request.body);
    if (!parsed.success) {
      await runtime.store.insert(TABLE_NAMES.WEBHOOK_EVENT_LOG, {
        id: randomUUID(),
        eventId: randomUUID(),
        provider: "meta",
        eventType: "message",
        status: "rejected",
        signatureValid: false,
        payloadHash: "",
        errorCode: "INVALID_PAYLOAD",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      });
      reply.code(400).send({ error: "Invalid WhatsApp payload" });
      return;
    }

    if ("userId" in parsed.data && "text" in parsed.data) {
      const payload = {
        userId: parsed.data.userId,
        text: parsed.data.text,
        ...(parsed.data.phoneNumber ? { phoneNumber: parsed.data.phoneNumber } : {}),
        ...(parsed.data.messageId ? { messageId: parsed.data.messageId } : {}),
        ...(parsed.data.inboundAt ? { inboundAt: parsed.data.inboundAt } : {})
      };
      const result = await processWhatsAppInbound(runtime, payload);
      await runtime.store.insert(TABLE_NAMES.WEBHOOK_EVENT_LOG, {
        id: randomUUID(),
        eventId: randomUUID(),
        provider: "meta",
        eventType: "direct_message",
        status: "accepted",
        signatureValid: true,
        ...(parsed.data.messageId ? { messageId: parsed.data.messageId } : {}),
        ...(parsed.data.phoneNumber ? { phoneNumber: parsed.data.phoneNumber } : {}),
        payloadHash: createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex"),
        errorCode: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      });
      reply.code(200).send(result);
      return;
    }

    const signature = request.headers["x-hub-signature-256"]?.toString();
    const result = await processWebhookPayload(runtime, {
      rawBody: JSON.stringify(parsed.data),
      ...(signature ? { signature } : {})
    });

    const message = parsed.data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    await runtime.store.insert(TABLE_NAMES.WEBHOOK_EVENT_LOG, {
      id: randomUUID(),
      eventId: randomUUID(),
      provider: "meta",
      eventType: "message",
      status: result.accepted ? "accepted" : "rejected",
      signatureValid: Boolean(result.accepted),
      ...(typeof message?.id === "string" ? { messageId: message.id } : {}),
      ...(typeof message?.from === "string" ? { phoneNumber: message.from } : {}),
      payloadHash: createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex"),
      errorCode: result.accepted ? "" : "SIGNATURE_INVALID",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    });

    reply.code(result.accepted ? 200 : 401).send(result);
  });
}
