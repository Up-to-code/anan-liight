import type { WaComplianceResult, WaConversationWindowState } from "@modules/whatsapp/types";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function computeConversationWindow(input: {
  phoneNumber: string;
  userId: string;
  lastInboundAt?: number;
  now?: number;
}): WaConversationWindowState {
  const now = input.now ?? Date.now();
  const lastInboundAt = input.lastInboundAt;
  const windowOpenUntil = lastInboundAt ? lastInboundAt + WINDOW_MS : undefined;
  const isOpen = windowOpenUntil != null ? now <= windowOpenUntil : false;
  return {
    phoneNumber: input.phoneNumber,
    userId: input.userId,
    ...(lastInboundAt != null ? { lastInboundAt } : {}),
    ...(windowOpenUntil != null ? { windowOpenUntil } : {}),
    isOpen
  };
}

export function enforceCampaignPolicy(input: {
  windowState: WaConversationWindowState;
  messageKind: "text" | "image" | "document" | "template" | "reaction";
  templateId?: string;
}): WaComplianceResult {
  if (input.windowState.isOpen) {
    return { allowed: true, reason: "ok", windowState: input.windowState };
  }
  if (input.messageKind !== "template") {
    return { allowed: false, reason: "window_closed_template_required", windowState: input.windowState };
  }
  if (!input.templateId) {
    return { allowed: false, reason: "missing_template", windowState: input.windowState };
  }
  return { allowed: true, reason: "ok", windowState: input.windowState };
}
