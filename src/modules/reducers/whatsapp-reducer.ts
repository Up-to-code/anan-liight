import type { RuntimeContainer } from "@modules/internal/runtime";
import { sendChatMessage } from "@modules/reducers/chat-reducer";
import { trackInboundConversation } from "@modules/whatsapp/conversations/service";

export interface WhatsAppInboundPayload {
  userId: string;
  text: string;
  phoneNumber?: string;
  messageId?: string;
  inboundAt?: number;
}

/**
 * Converts WhatsApp text event to standard chat send flow.
 * @param runtime Runtime container
 * @param payload Inbound payload
 */
export async function processWhatsAppInbound(
  runtime: RuntimeContainer,
  payload: WhatsAppInboundPayload
): Promise<{ status: "accepted"; threadId: string }> {
  if (payload.phoneNumber) {
    await trackInboundConversation(runtime, {
      phoneNumber: payload.phoneNumber,
      userId: payload.userId,
      ...(payload.messageId ? { messageId: payload.messageId } : {}),
      text: payload.text,
      ...(payload.inboundAt ? { inboundAt: payload.inboundAt } : {})
    });
  }

  const result = await sendChatMessage(runtime, {
    message: payload.text,
    userId: payload.userId,
    channel: "whatsapp",
    idempotencyKey: `wa:${payload.userId}:${Date.now()}`
  });
  return { status: "accepted", threadId: result.threadId };
}
