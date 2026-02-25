import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { whatsappInboundSchema } from "@api/schema/whatsapp";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { processWhatsAppInbound } from "@modules/reducers/whatsapp-reducer";
import { processWebhookPayload } from "@modules/whatsapp/webhook/service";
import { ROUTE_PATHS } from "@shared/constants";

export async function registerWhatsAppRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.get(ROUTE_PATHS.WHATSAPP_WEBHOOK, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { [key: string]: string | undefined };
    const challenge = query["hub.challenge"];
    const mode = query["hub.mode"];
    const verifyToken = query["hub.verify_token"];
    if (!challenge || mode !== "subscribe") {
      reply.code(400).send({ error: "Invalid webhook verification payload" });
      return;
    }
    if (runtime.env.WHATSAPP_VERIFY_TOKEN && verifyToken !== runtime.env.WHATSAPP_VERIFY_TOKEN) {
      reply.code(403).send({ error: "Webhook verify token mismatch" });
      return;
    }
    reply.code(200).send(challenge);
  });

  app.post(ROUTE_PATHS.WHATSAPP_WEBHOOK, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!runtime.env.FEATURE_LLIGHT_WA_WEBHOOK_ENABLED) {
      reply.code(404).send({ error: "Not available" });
      return;
    }

    const parsed = whatsappInboundSchema.safeParse(request.body);
    if (!parsed.success) {
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
      reply.code(200).send(result);
      return;
    }

    const signature = request.headers["x-hub-signature-256"]?.toString();
    const result = await processWebhookPayload(runtime, {
      rawBody: JSON.stringify(parsed.data),
      ...(signature ? { signature } : {})
    });

    reply.code(result.accepted ? 200 : 401).send(result);
  });
}
