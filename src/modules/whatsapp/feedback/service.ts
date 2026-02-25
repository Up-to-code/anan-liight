import { randomUUID } from "node:crypto";
import type { RuntimeContainer } from "@modules/internal/runtime";
import type { WaFeedbackEvent } from "@modules/whatsapp/types";
import { TABLE_NAMES } from "@shared/constants";

export async function addFeedback(runtime: RuntimeContainer, input: Omit<WaFeedbackEvent, "feedbackId" | "createdAt">): Promise<WaFeedbackEvent> {
  const event: WaFeedbackEvent = {
    ...input,
    feedbackId: randomUUID(),
    createdAt: Date.now()
  };

  await runtime.store.insert(TABLE_NAMES.WA_FEEDBACK_EVENTS, {
    id: randomUUID(),
    ...event,
    version: 1,
    updatedAt: event.createdAt
  });

  await runtime.store.insert(TABLE_NAMES.NOTIFICATIONS, {
    id: randomUUID(),
    title: "WhatsApp feedback",
    message: event.text,
    audience: "admin",
    priority: event.level === "critical" ? "urgent" : "medium",
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
    version: 1
  });

  return event;
}
