import { randomUUID } from "node:crypto";
import type { RuntimeContainer } from "@modules/internal/runtime";
import type { WaSendResult } from "@modules/whatsapp/types";
import { TABLE_NAMES } from "@shared/constants";

export async function logDeliveryAttempt(runtime: RuntimeContainer, input: {
  campaignId?: string;
  userId: string;
  phoneNumber: string;
  requestType: string;
  result: WaSendResult;
  providerMessageId?: string;
}): Promise<void> {
  const now = Date.now();
  await runtime.store.insert(TABLE_NAMES.WHATSAPP_DELIVERY_LOGS, {
    id: randomUUID(),
    phoneNumber: input.phoneNumber,
    conversationId: input.userId,
    providerMessageId: input.providerMessageId ?? input.result.providerMessageId ?? randomUUID(),
    status: input.result.success ? "sent" : "failed",
    messageType: input.requestType,
    error: input.result.errorMessage,
    retries: 0,
    responseTimeMs: input.result.latencyMs,
    createdAt: now,
    updatedAt: now,
    version: 1,
    campaignId: input.campaignId
  });
}

export async function ingestDeliveryStatus(runtime: RuntimeContainer, payload: Record<string, unknown>): Promise<void> {
  const now = Date.now();
  await runtime.store.insert(TABLE_NAMES.WA_POLICY_AUDIT_LOG, {
    id: randomUUID(),
    auditId: randomUUID(),
    event: "delivery_status",
    payloadJson: JSON.stringify(payload),
    createdAt: now,
    updatedAt: now,
    version: 1
  });
}
