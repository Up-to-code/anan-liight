import { z } from "zod";

export const waTemplateDraftSchema = z.object({
  name: z.string().min(1),
  language: z.string().min(2),
  category: z.enum(["marketing", "utility", "authentication"]),
  body: z.string().min(1),
  variables: z.array(z.string()).optional()
});

export const waCampaignCreateSchema = z.object({
  name: z.string().min(1),
  messageKind: z.enum(["text", "image", "document", "template", "reaction"]),
  payload: z.record(z.string(), z.string()),
  audience: z.array(z.string().min(3)).min(1),
  templateId: z.string().optional(),
  scheduledAt: z.number().int().positive().optional()
});

export const waCampaignRunSchema = z.object({
  campaignId: z.string().min(1),
  recipients: z.array(z.object({ userId: z.string().min(1), phoneNumber: z.string().min(6) })).optional(),
  maxMessages: z.number().int().positive().max(100).optional()
});

export const waFeedbackSchema = z.object({
  campaignId: z.string().optional(),
  messageId: z.string().optional(),
  source: z.enum(["agent", "operator", "system"]),
  level: z.enum(["info", "warning", "critical"]),
  text: z.string().min(1)
});
