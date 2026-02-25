import type { RuntimeContainer } from "@modules/internal/runtime";
import { parseInboundMedia } from "@lib/whatsapp/media";
import { verifyMetaWebhookSignature } from "@lib/whatsapp/signature";
import { trackInboundConversation } from "@modules/whatsapp/conversations/service";
import { processWhatsAppInbound } from "@modules/reducers/whatsapp-reducer";
import { incrementCounter, observeDuration } from "@lib/observability/metrics";

export async function processWebhookPayload(runtime: RuntimeContainer, input: {
  rawBody: string;
  signature?: string;
  appSecret?: string;
}): Promise<{ accepted: boolean; processed: number }> {
  const startedAt = Date.now();
  const secret = input.appSecret ?? runtime.env.WHATSAPP_APP_SECRET;
  if (secret && !verifyMetaWebhookSignature(input.rawBody, input.signature, secret)) {
    incrementCounter("wa.webhook.rejected", { reason: "signature" });
    observeDuration("wa.webhook.total_latency_ms", Date.now() - startedAt, { status: "rejected" });
    return { accepted: false, processed: 0 };
  }

  const payload = JSON.parse(input.rawBody) as {
    entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
  };

  let processed = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];
      for (const message of messages) {
        const from = typeof message["from"] === "string" ? message["from"] : "";
        const messageId = typeof message["id"] === "string" ? message["id"] : undefined;
        const text = typeof ((message["text"] as { body?: string } | undefined)?.body) === "string"
          ? ((message["text"] as { body: string }).body)
          : "";

        if (!from) continue;
        const media = parseInboundMedia(message);
        const userId = `wa-${from}`;

        await trackInboundConversation(runtime, {
          phoneNumber: from,
          userId,
          ...(messageId ? { messageId } : {}),
          text: text || `[${media.mediaType}]`
        });

        await processWhatsAppInbound(runtime, {
          userId,
          text: text || `[${media.mediaType}]`,
          phoneNumber: from,
          ...(messageId ? { messageId } : {})
        });
        processed += 1;
      }
    }
  }

  incrementCounter("wa.webhook.accepted", { processed: processed > 0 ? "yes" : "no" });
  observeDuration("wa.webhook.total_latency_ms", Date.now() - startedAt, { status: "ok" });
  return { accepted: true, processed };
}
