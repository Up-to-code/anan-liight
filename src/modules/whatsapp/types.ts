export type WaTemplateCategory = "marketing" | "utility" | "authentication";
export type WaCampaignStatus = "draft" | "scheduled" | "running" | "paused" | "cancelled" | "completed";
export type WaMessageKind = "text" | "image" | "document" | "template" | "reaction";

export interface WaTemplate {
  templateId: string;
  name: string;
  language: string;
  category: WaTemplateCategory;
  body: string;
  variables: string[];
  status: "draft" | "submitted" | "approved" | "rejected";
  createdAt: number;
  updatedAt: number;
}

export interface WaCampaign {
  campaignId: string;
  name: string;
  templateId?: string | undefined;
  messageKind: WaMessageKind;
  payload: Record<string, string>;
  audience: string[];
  scheduledAt?: number | undefined;
  status: WaCampaignStatus;
  createdAt: number;
  updatedAt: number;
}

export interface WaConversationWindowState {
  phoneNumber: string;
  userId: string;
  lastInboundAt?: number | undefined;
  windowOpenUntil?: number | undefined;
  isOpen: boolean;
}

export interface WaComplianceResult {
  allowed: boolean;
  reason: "ok" | "window_closed_template_required" | "missing_template" | "invalid_payload";
  windowState: WaConversationWindowState;
}

export interface WaSendRequest {
  to: string;
  type: WaMessageKind;
  body?: string | undefined;
  mediaUrl?: string | undefined;
  templateName?: string | undefined;
  templateParams?: string[] | undefined;
  reactionToMessageId?: string | undefined;
  reactionEmoji?: string | undefined;
  idempotencyKey: string;
}

export interface WaSendResult {
  success: boolean;
  providerMessageId?: string | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  latencyMs: number;
}

export interface WaFeedbackEvent {
  feedbackId: string;
  campaignId?: string | undefined;
  messageId?: string | undefined;
  source: "agent" | "operator" | "system";
  level: "info" | "warning" | "critical";
  text: string;
  createdAt: number;
}
