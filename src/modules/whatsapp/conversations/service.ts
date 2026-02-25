import { randomUUID } from "node:crypto";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { computeConversationWindow } from "@lib/whatsapp/policy-guards";
import type { WaConversationWindowState } from "@modules/whatsapp/types";
import { TABLE_NAMES } from "@shared/constants";

function normalizePhone(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");
}

export async function trackInboundConversation(runtime: RuntimeContainer, input: {
  phoneNumber: string;
  userId: string;
  messageId?: string;
  text?: string;
  inboundAt?: number;
}): Promise<WaConversationWindowState> {
  const now = input.inboundAt ?? Date.now();
  const phoneNumber = normalizePhone(input.phoneNumber);

  const existingProfile = await runtime.store.queryOne<{ id: string; version: number }>(TABLE_NAMES.USER_PROFILES, [
    { field: "userId", op: "eq", value: input.userId }
  ]);
  if (existingProfile) {
    await runtime.store.updateVersioned(TABLE_NAMES.USER_PROFILES, existingProfile.id, existingProfile.version, {
      phoneNumber,
      updatedAt: now,
      version: existingProfile.version + 1
    });
  } else {
    await runtime.store.insert(TABLE_NAMES.USER_PROFILES, {
      id: randomUUID(),
      userId: input.userId,
      phoneNumber,
      name: "",
      locale: "ar",
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  await runtime.store.insert(TABLE_NAMES.WHATSAPP_INBOUND_EVENTS, {
    id: randomUUID(),
    providerEventId: input.messageId ?? randomUUID(),
    userId: input.userId,
    phoneNumber,
    eventType: "message",
    text: input.text ?? "",
    status: "done",
    createdAt: now,
    updatedAt: now,
    version: 1
  });

  await runtime.store.insert(TABLE_NAMES.WA_CONVERSATION_WINDOWS, {
    id: randomUUID(),
    windowId: randomUUID(),
    phoneNumber,
    userId: input.userId,
    lastInboundAt: now,
    windowOpenUntil: now + 24 * 60 * 60 * 1000,
    createdAt: now,
    updatedAt: now,
    version: 1
  });

  return computeConversationWindow({ phoneNumber, userId: input.userId, lastInboundAt: now, now });
}

export async function getConversationWindow(runtime: RuntimeContainer, input: {
  phoneNumber: string;
  userId: string;
}): Promise<WaConversationWindowState> {
  const phoneNumber = normalizePhone(input.phoneNumber);
  const row = await runtime.store.queryOne<{ lastInboundAt?: number }>(TABLE_NAMES.WA_CONVERSATION_WINDOWS, [
    { field: "phoneNumber", op: "eq", value: phoneNumber },
    { field: "userId", op: "eq", value: input.userId }
  ]);

  return computeConversationWindow({
    phoneNumber,
    userId: input.userId,
    ...(row?.lastInboundAt != null ? { lastInboundAt: row.lastInboundAt } : {})
  });
}
