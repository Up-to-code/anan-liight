import { mapWhatsAppError } from "@lib/whatsapp/error-map";
import type { WaSendRequest, WaSendResult } from "@modules/whatsapp/types";

export class WhatsAppCloudClient {
  public constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
    private readonly apiVersion = "v21.0"
  ) {}

  private get endpoint(): string {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  public async send(request: WaSendRequest): Promise<WaSendResult> {
    const startedAt = Date.now();
    const payload = this.toPayload(request);
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const mapped = mapWhatsAppError(response.status, bodyText);
      return {
        success: false,
        errorCode: mapped.code,
        errorMessage: mapped.message,
        latencyMs: Date.now() - startedAt
      };
    }

    const data = (await response.json()) as { messages?: Array<{ id: string }> };
    return {
      success: true,
      ...(data.messages?.[0]?.id ? { providerMessageId: data.messages[0].id } : {}),
      latencyMs: Date.now() - startedAt
    };
  }

  private toPayload(request: WaSendRequest): Record<string, unknown> {
    if (request.type === "template") {
      return {
        messaging_product: "whatsapp",
        to: request.to,
        type: "template",
        template: {
          name: request.templateName,
          language: { code: "en" },
          components: request.templateParams?.length
            ? [{ type: "body", parameters: request.templateParams.map((text) => ({ type: "text", text })) }]
            : undefined
        }
      };
    }
    if (request.type === "reaction") {
      return {
        messaging_product: "whatsapp",
        to: request.to,
        type: "reaction",
        reaction: { message_id: request.reactionToMessageId, emoji: request.reactionEmoji ?? "👍" }
      };
    }
    if (request.type === "image") {
      return {
        messaging_product: "whatsapp",
        to: request.to,
        type: "image",
        image: { link: request.mediaUrl, caption: request.body }
      };
    }
    if (request.type === "document") {
      return {
        messaging_product: "whatsapp",
        to: request.to,
        type: "document",
        document: { link: request.mediaUrl, caption: request.body, filename: "document" }
      };
    }
    return {
      messaging_product: "whatsapp",
      to: request.to,
      type: "text",
      text: { body: request.body ?? "", preview_url: false }
    };
  }
}
