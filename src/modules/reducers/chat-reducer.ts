import { randomUUID } from "node:crypto";
import { AppError } from "@lib/errors/app-error";
import { formatStructuredForChannel } from "@lib/text/channel-formatter";
import { buildStructuredResponse } from "@lib/text/response-contract";
import { incrementCounter } from "@lib/observability/metrics";
import { startIdempotentExecution, completeIdempotentExecution } from "@modules/internal/idempotency";
import { addMessage, createThread } from "@modules/internal/repositories";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { TABLE_NAMES } from "@shared/constants";

export interface SendChatInput {
  threadId?: string;
  message: string;
  userId: string;
  channel: "web" | "app" | "whatsapp";
  idempotencyKey: string;
}

export function responseLengthBucket(length: number): string {
  if (length < 120) return "short";
  if (length < 320) return "medium";
  return "long";
}

/**
 * Stores incoming user message and queues assistant generation.
 * @param runtime Runtime container
 * @param input Chat input
 * @returns Thread id and message id
 */
export async function sendChatMessage(
  runtime: RuntimeContainer,
  input: SendChatInput
): Promise<{ threadId: string; messageId: string }> {
  if (input.message.trim().length === 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "message required",
      payload: { reason: "Empty message" },
      retryable: false
    });
  }

  await startIdempotentExecution(runtime.store, input.idempotencyKey, "chat-send");

  const threadId = input.threadId ?? (await createThread(runtime.store, input.userId, input.channel));
  const messageId = await addMessage(runtime.store, {
    threadId,
    userId: input.userId,
    role: "user",
    body: input.message,
    channel: input.channel
  });

  runtime.runner.enqueue(randomUUID(), "NORMAL", async () => {
    const rawReply = await runtime.generateAssistantText(input.message);
    let finalReply = rawReply;

    try {
      const structured = buildStructuredResponse(rawReply);
      const formatted = formatStructuredForChannel(structured, input.channel);
      if (formatted.trim() !== rawReply.trim()) {
        incrementCounter("text.contract.repair", { channel: input.channel, mode: "normalize" });
      }
      if (runtime.env.FEATURE_TEXT_CONTRACT_ENFORCED) {
        finalReply = formatted;
        incrementCounter("text.contract.pass", { channel: input.channel, mode: "enforced" });
      } else if (runtime.env.FEATURE_TEXT_CONTRACT_SHADOW) {
        incrementCounter("text.contract.pass", { channel: input.channel, mode: "shadow" });
      }

      await runtime.store.insert(TABLE_NAMES.AGENT_TRACES, {
        id: randomUUID(),
        agentId: "assistant",
        event: "text_contract_applied",
        payload: JSON.stringify({
          rawReply,
          structured,
          formatted,
          channel: input.channel,
          enforced: runtime.env.FEATURE_TEXT_CONTRACT_ENFORCED
        }),
        createdAt: Date.now()
      });
      incrementCounter("text.length.bucket", {
        channel: input.channel,
        bucket: responseLengthBucket(formatted.length)
      });
    } catch (error) {
      incrementCounter("text.contract.fail", { channel: input.channel });
      incrementCounter("text.contract.repair", { channel: input.channel, mode: "fallback" });
      if (runtime.env.FEATURE_TEXT_CONTRACT_ENFORCED) {
        const fallback = buildStructuredResponse(
          input.channel === "whatsapp"
            ? "تم تجهيز الرد. راجع النقاط التالية. هل تريد أن أكمل؟"
            : "Response prepared. Please review the key points. Would you like me to continue?"
        );
        finalReply = formatStructuredForChannel(fallback, input.channel);
      }
      await runtime.store.insert(TABLE_NAMES.AGENT_TRACES, {
        id: randomUUID(),
        agentId: "assistant",
        event: "text_contract_failed",
        payload: JSON.stringify({
          channel: input.channel,
          reason: error instanceof Error ? error.message : "unknown"
        }),
        createdAt: Date.now()
      });
      incrementCounter("text.length.bucket", {
        channel: input.channel,
        bucket: responseLengthBucket(finalReply.length)
      });
    }

    await addMessage(runtime.store, {
      threadId,
      userId: input.userId,
      role: "assistant",
      body: finalReply,
      channel: input.channel
    });
  });

  await completeIdempotentExecution(runtime.store, input.idempotencyKey, "chat-send", { threadId, messageId });
  return { threadId, messageId };
}

/**
 * Generates assistant response synchronously for diagnostics endpoints.
 * @param runtime Runtime container
 * @param message Prompt message
 * @returns Assistant text
 */
export async function generateReply(runtime: RuntimeContainer, message: string): Promise<string> {
  const rawReply = await runtime.generateAssistantText(message);
  try {
    const structured = buildStructuredResponse(rawReply);
    if (runtime.env.FEATURE_TEXT_CONTRACT_ENFORCED) {
      return formatStructuredForChannel(structured, "app");
    }
  } catch {
    // Fallback to raw response for compatibility.
  }
  return rawReply;
}
