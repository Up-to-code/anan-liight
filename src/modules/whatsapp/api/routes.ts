import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { requireAdmin } from "@api/middleware/auth";
import {
  waCampaignCreateSchema,
  waCampaignRunSchema,
  waFeedbackSchema,
  waTemplateDraftSchema
} from "@api/schema/whatsapp-platform";
import { createTemplateDraft, fetchTemplateCatalog, submitTemplate, syncTemplateStatus } from "@modules/whatsapp/templates/service";
import { createCampaign, executeCampaign, scheduleCampaign, updateCampaignStatus } from "@modules/whatsapp/campaigns/service";
import { getWhatsAppPerformance } from "@modules/whatsapp/metrics/service";
import { addFeedback } from "@modules/whatsapp/feedback/service";
import { TABLE_NAMES } from "@shared/constants";

interface CampaignRow {
  campaignId: string;
  name: string;
  templateId?: string;
  messageKind: "text" | "image" | "document" | "template" | "reaction";
  payloadJson?: string;
  audienceJson?: string;
  status: "draft" | "scheduled" | "running" | "paused" | "cancelled" | "completed";
  createdAt: number;
  updatedAt: number;
  scheduledAt?: number;
}

export async function registerWhatsAppPlatformRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.post("/api/whatsapp/templates", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = waTemplateDraftSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid template payload" });
    const template = await createTemplateDraft(runtime, {
      name: parsed.data.name,
      language: parsed.data.language,
      category: parsed.data.category,
      body: parsed.data.body,
      ...(parsed.data.variables ? { variables: parsed.data.variables } : {})
    });
    return reply.code(201).send(template);
  });

  app.post("/api/whatsapp/templates/:templateId/submit", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { templateId?: string };
    if (!params.templateId) return reply.code(400).send({ error: "templateId required" });
    const result = await submitTemplate(runtime, params.templateId);
    return reply.code(200).send(result);
  });

  app.post("/api/whatsapp/templates/:templateId/sync", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { templateId?: string };
    const body = request.body as { providerStatus?: string };
    if (!params.templateId || !body.providerStatus) return reply.code(400).send({ error: "templateId and providerStatus required" });
    await syncTemplateStatus(runtime, params.templateId, body.providerStatus);
    return reply.code(200).send({ ok: true });
  });

  app.get("/api/whatsapp/templates", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { locale?: string };
    const templates = await fetchTemplateCatalog(runtime, query.locale);
    return reply.code(200).send({ templates });
  });

  app.post("/api/whatsapp/campaigns", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!runtime.env.FEATURE_LLIGHT_WA_CAMPAIGNS_ENABLED) {
      return reply.code(404).send({ error: "Campaigns disabled" });
    }
    const parsed = waCampaignCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid campaign payload" });
    const campaign = await createCampaign(runtime, {
      name: parsed.data.name,
      messageKind: parsed.data.messageKind,
      payload: parsed.data.payload,
      audience: parsed.data.audience,
      ...(parsed.data.templateId ? { templateId: parsed.data.templateId } : {}),
      ...(parsed.data.scheduledAt ? { scheduledAt: parsed.data.scheduledAt } : {})
    });
    if (campaign.scheduledAt) {
      await scheduleCampaign(runtime, campaign.campaignId, campaign.scheduledAt);
    }
    return reply.code(201).send(campaign);
  });

  app.post("/api/whatsapp/campaigns/run", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!runtime.env.FEATURE_LLIGHT_WA_CAMPAIGNS_ENABLED) {
      return reply.code(404).send({ error: "Campaigns disabled" });
    }
    const parsed = waCampaignRunSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid run payload" });

    const rows = await runtime.store.queryMany<CampaignRow>(TABLE_NAMES.WA_CAMPAIGNS, [{ field: "campaignId", op: "eq", value: parsed.data.campaignId }], 1);
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: "Campaign not found" });

    const campaign = {
      campaignId: row.campaignId,
      name: row.name,
      ...(row.templateId ? { templateId: row.templateId } : {}),
      messageKind: row.messageKind,
      payload: JSON.parse(row.payloadJson ?? "{}") as Record<string, string>,
      audience: JSON.parse(row.audienceJson ?? "[]") as string[],
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(row.scheduledAt ? { scheduledAt: row.scheduledAt } : {})
    };

    await updateCampaignStatus(runtime, campaign.campaignId, "running");
    const recipients = parsed.data.recipients ?? campaign.audience.map((phoneNumber) => ({ userId: `wa-${phoneNumber}`, phoneNumber }));
    const maxMessages = Math.min(parsed.data.maxMessages ?? runtime.env.WHATSAPP_MAX_BATCH_SEND, runtime.env.WHATSAPP_MAX_BATCH_SEND);
    const result = await executeCampaign(runtime, { campaign, recipients, maxMessages });
    await updateCampaignStatus(runtime, campaign.campaignId, "completed");
    return reply.code(200).send(result);
  });

  app.post("/api/whatsapp/feedback", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = waFeedbackSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid feedback payload" });
    const event = await addFeedback(runtime, {
      source: parsed.data.source,
      level: parsed.data.level,
      text: parsed.data.text,
      ...(parsed.data.campaignId ? { campaignId: parsed.data.campaignId } : {}),
      ...(parsed.data.messageId ? { messageId: parsed.data.messageId } : {})
    });
    return reply.code(201).send(event);
  });

  app.get("/api/whatsapp/performance", { preHandler: requireAdmin(runtime) }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await getWhatsAppPerformance(runtime, 500);
    return reply.code(200).send(metrics);
  });
}
