import { createHash, randomUUID, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAdmin } from "@api/middleware/auth";
import { waCampaignCreateSchema, waCampaignRunSchema, waTemplateDraftSchema } from "@api/schema/whatsapp-platform";
import { getReadiness } from "@modules/queries/health-query";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { TABLE_NAMES } from "@shared/constants";
import { createCampaign, executeCampaign, updateCampaignStatus } from "@modules/whatsapp/campaigns/service";
import { createTemplateDraft, fetchTemplateCatalog, submitTemplate, syncTemplateStatus } from "@modules/whatsapp/templates/service";
import { getWhatsAppPerformance } from "@modules/whatsapp/metrics/service";

interface CursorQuery {
  cursor?: string;
  limit?: string;
}

interface CampaignRow {
  id: string;
  version: number;
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

interface CircuitRow {
  id: string;
  version: number;
  circuit: string;
  failures: number;
  status?: string;
  openedAt?: number;
  updatedAt: number;
}

interface FeatureFlagRow {
  id: string;
  version: number;
  flagKey: string;
  enabled: boolean;
  source: string;
  createdAt: number;
  updatedAt: number;
}

interface DeadLetterRow {
  id: string;
  version: number;
  deadLetterId: string;
  scope: string;
  operation: string;
  payloadJson: string;
  createdAt: number;
  updatedAt: number;
}

async function safeQueryMany<T extends object>(
  runtime: RuntimeContainer,
  table: string,
  filters: Array<{ field: string; op: "eq"; value: string | number | boolean }> = [],
  limit = 1000
): Promise<{ rows: T[]; error?: string }> {
  try {
    const rows = await runtime.store.queryMany<T>(table, filters, limit);
    return { rows };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "store_query_failed" };
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, pair) => {
    const [key, ...rest] = pair.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("=") ?? "");
    return acc;
  }, {});
}

function parseLimit(value: string | undefined, fallback = 50, max = 200): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function applyCursor<T extends { createdAt?: number; updatedAt?: number }>(rows: T[], query: CursorQuery): { rows: T[]; nextCursor?: string } {
  const limit = parseLimit(query.limit);
  const cursor = query.cursor ? Number(query.cursor) : null;
  const sorted = [...rows].sort((a, b) => (b.createdAt ?? b.updatedAt ?? 0) - (a.createdAt ?? a.updatedAt ?? 0));
  const filtered = cursor ? sorted.filter((row) => (row.createdAt ?? row.updatedAt ?? 0) < cursor) : sorted;
  const page = filtered.slice(0, limit);
  const tail = page[page.length - 1];
  return {
    rows: page,
    ...(tail ? { nextCursor: String(tail.createdAt ?? tail.updatedAt ?? 0) } : {})
  };
}

async function writeAdminAudit(runtime: RuntimeContainer, request: FastifyRequest, input: {
  actionType: string;
  targetType: string;
  targetId: string;
  reason: string;
  confirmation: string;
  payload: Record<string, unknown>;
  result: "success" | "failed";
}): Promise<void> {
  const now = Date.now();
  const confirmationPhraseHash = createHash("sha256").update(input.confirmation).digest("hex");
  await runtime.store.insert(TABLE_NAMES.ADMIN_ACTION_AUDIT, {
    id: randomUUID(),
    actionId: randomUUID(),
    actorUserId: request.authContext?.userId ?? "unknown",
    actorTenantId: request.authContext?.tenantId ?? "unknown",
    actorAuthSource: request.authContext?.authSource ?? "unknown",
    actionType: input.actionType,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    confirmationPhraseHash,
    payloadJson: JSON.stringify(input.payload),
    result: input.result,
    createdAt: now,
    updatedAt: now,
    version: 1
  });
}

function requireCsrf(request: FastifyRequest, reply: FastifyReply): boolean {
  const token = request.headers["x-csrf-token"]?.toString() ?? "";
  const cookieToken = parseCookies(request.headers.cookie)["anan_csrf"] ?? "";
  if (!token || !cookieToken || token !== cookieToken) {
    reply.code(403).send({ error: "CSRF validation failed" });
    return false;
  }
  return true;
}

function requireDestructiveSafety(
  runtime: RuntimeContainer,
  reply: FastifyReply,
  input: { reason?: string; confirmation?: string }
): boolean {
  if (!runtime.env.FEATURE_ADMIN_DESTRUCTIVE_ACTIONS) {
    reply.code(403).send({ error: "Destructive actions disabled" });
    return false;
  }

  const reason = input.reason?.trim() ?? "";
  const confirmation = input.confirmation?.trim() ?? "";
  if (reason.length === 0 || confirmation !== "CONFIRM") {
    reply.code(400).send({ error: "reason and confirmation=CONFIRM are required" });
    return false;
  }

  return true;
}

export async function registerAdminRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.get("/api/admin/csrf", { preHandler: requireAdmin(runtime) }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const csrfToken = randomBytes(24).toString("hex");
    reply.header("Set-Cookie", `anan_csrf=${encodeURIComponent(csrfToken)}; Path=/; HttpOnly; SameSite=Strict; ${runtime.env.NODE_ENV === "production" ? "Secure;" : ""}`);
    return reply.code(200).send({ csrfToken });
  });

  app.get("/api/admin/overview", { preHandler: requireAdmin(runtime) }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const readiness = await getReadiness(runtime);
    const waPerformance = await getWhatsAppPerformance(runtime, 500).catch(() => ({
      total: 0,
      sent: 0,
      failed: 0,
      avgLatencyMs: 0
    }));
    const [apiEvents, webhookEvents, deadLetters, workflows, circuits, flags] = await Promise.all([
      safeQueryMany(runtime, TABLE_NAMES.API_EVENT_LOG, [], 500),
      safeQueryMany(runtime, TABLE_NAMES.WEBHOOK_EVENT_LOG, [], 500),
      safeQueryMany(runtime, TABLE_NAMES.DEAD_LETTERS, [], 500),
      safeQueryMany(runtime, TABLE_NAMES.WORKFLOW_STEP_EVENTS, [], 500),
      safeQueryMany(runtime, TABLE_NAMES.CIRCUIT_BREAKER_STATE, [], 500),
      safeQueryMany(runtime, TABLE_NAMES.FEATURE_FLAGS, [], 500)
    ]);

    return reply.code(200).send({
      service: "anan-liight",
      ready: readiness.ready,
      checks: readiness.checks,
      whatsapp: waPerformance,
      counts: {
        apiEvents: apiEvents.rows.length,
        webhookEvents: webhookEvents.rows.length,
        deadLetters: deadLetters.rows.length,
        workflowEvents: workflows.rows.length,
        circuitBreakers: circuits.rows.length,
        featureFlags: flags.rows.length
      },
      errors: [
        apiEvents.error,
        webhookEvents.error,
        deadLetters.error,
        workflows.error,
        circuits.error,
        flags.error
      ].filter(Boolean)
    });
  });

  app.get("/api/admin/logs/api", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { route?: string; level?: string };
    const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.API_EVENT_LOG, [], 1000);
    const rows = result.rows;
    const filtered = rows.filter((row) => {
      if (query.route && String(row["route"] ?? "") !== query.route) return false;
      if (query.level && String(row["level"] ?? "") !== query.level) return false;
      return true;
    });
    return reply.code(200).send({ ...applyCursor(filtered, query), ...(result.error ? { error: result.error } : {}) });
  });

  app.get("/api/admin/logs/webhooks", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { status?: string };
    const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.WEBHOOK_EVENT_LOG, [], 1000);
    const rows = result.rows;
    const filtered = rows.filter((row) => !query.status || String(row["status"] ?? "") === query.status);
    return reply.code(200).send({ ...applyCursor(filtered, query), ...(result.error ? { error: result.error } : {}) });
  });

  app.get("/api/admin/whatsapp/templates", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { locale?: string };
    const templates = await fetchTemplateCatalog(runtime, query.locale);
    return reply.code(200).send({ templates });
  });

  app.post("/api/admin/whatsapp/templates", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
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

  app.post("/api/admin/whatsapp/templates/:templateId/submit", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const templateId = (request.params as { templateId?: string }).templateId;
    if (!templateId) return reply.code(400).send({ error: "templateId required" });
    const result = await submitTemplate(runtime, templateId);
    return reply.code(200).send(result);
  });

  app.post("/api/admin/whatsapp/templates/:templateId/sync", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const templateId = (request.params as { templateId?: string }).templateId;
    const providerStatus = (request.body as { providerStatus?: string }).providerStatus;
    if (!templateId || !providerStatus) return reply.code(400).send({ error: "templateId and providerStatus required" });
    await syncTemplateStatus(runtime, templateId, providerStatus);
    return reply.code(200).send({ ok: true });
  });

  app.get("/api/admin/whatsapp/campaigns", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { status?: string };
    const result = await safeQueryMany<CampaignRow>(runtime, TABLE_NAMES.WA_CAMPAIGNS, [], 1000);
    const rows = result.rows;
    const shaped = rows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payloadJson ?? "{}") as Record<string, string>,
      audience: JSON.parse(row.audienceJson ?? "[]") as string[]
    }));
    const filtered = shaped.filter((row) => !query.status || row.status === query.status);
    return reply.code(200).send({ ...applyCursor(filtered, query), ...(result.error ? { error: result.error } : {}) });
  });

  app.post("/api/admin/whatsapp/campaigns", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
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

    return reply.code(201).send(campaign);
  });

  app.post("/api/admin/whatsapp/campaigns/:campaignId/run", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const campaignId = (request.params as { campaignId?: string }).campaignId;
    if (!campaignId) return reply.code(400).send({ error: "campaignId required" });

    const runParsed = waCampaignRunSchema.safeParse({
      campaignId,
      ...((request.body as object | undefined) ?? {})
    });
    if (!runParsed.success) return reply.code(400).send({ error: "Invalid run payload" });

    const row = (await runtime.store.queryMany<CampaignRow>(TABLE_NAMES.WA_CAMPAIGNS, [{ field: "campaignId", op: "eq", value: campaignId }], 1))[0];
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
    const recipients = runParsed.data.recipients ?? campaign.audience.map((phoneNumber) => ({ userId: `wa-${phoneNumber}`, phoneNumber }));
    const result = await executeCampaign(runtime, {
      campaign,
      recipients,
      ...(runParsed.data.maxMessages ? { maxMessages: runParsed.data.maxMessages } : {})
    });
    await updateCampaignStatus(runtime, campaign.campaignId, "completed");

    return reply.code(200).send(result);
  });

  const mutateCampaignStatus = async (
    request: FastifyRequest,
    reply: FastifyReply,
    status: CampaignRow["status"]
  ) => {
    if (!requireCsrf(request, reply)) return;
    const campaignId = (request.params as { campaignId?: string }).campaignId;
    if (!campaignId) return reply.code(400).send({ error: "campaignId required" });
    const row = (await runtime.store.queryMany<CampaignRow>(TABLE_NAMES.WA_CAMPAIGNS, [{ field: "campaignId", op: "eq", value: campaignId }], 1))[0];
    if (!row) return reply.code(404).send({ error: "Campaign not found" });

    const ok = await runtime.store.updateVersioned<CampaignRow>(TABLE_NAMES.WA_CAMPAIGNS, row.id, row.version, {
      ...row,
      status,
      updatedAt: Date.now()
    });
    if (!ok) return reply.code(409).send({ error: "Version conflict" });

    await updateCampaignStatus(runtime, campaignId, status);
    return reply.code(200).send({ ok: true, status });
  };

  app.post("/api/admin/whatsapp/campaigns/:campaignId/pause", { preHandler: requireAdmin(runtime) }, async (request, reply) => mutateCampaignStatus(request, reply, "paused"));
  app.post("/api/admin/whatsapp/campaigns/:campaignId/resume", { preHandler: requireAdmin(runtime) }, async (request, reply) => mutateCampaignStatus(request, reply, "running"));
  app.post("/api/admin/whatsapp/campaigns/:campaignId/cancel", { preHandler: requireAdmin(runtime) }, async (request, reply) => mutateCampaignStatus(request, reply, "cancelled"));

  app.get("/api/admin/ops/dead-letters", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { scope?: string };
    const result = await safeQueryMany<DeadLetterRow>(runtime, TABLE_NAMES.DEAD_LETTERS, [], 1000);
    const rows = result.rows;
    const filtered = rows.filter((row) => !query.scope || row.scope === query.scope);
    return reply.code(200).send({ ...applyCursor(filtered, query), ...(result.error ? { error: result.error } : {}) });
  });

  app.post("/api/admin/ops/dead-letters/:deadLetterId/replay", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;

    const deadLetterId = (request.params as { deadLetterId?: string }).deadLetterId;
    const body = (request.body ?? {}) as { reason?: string; confirmation?: string };

    if (!deadLetterId) return reply.code(400).send({ error: "deadLetterId required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const row = (await runtime.store.queryMany<DeadLetterRow>(TABLE_NAMES.DEAD_LETTERS, [{ field: "deadLetterId", op: "eq", value: deadLetterId }], 1))[0];
    if (!row) return reply.code(404).send({ error: "Dead letter not found" });

    const payload = JSON.parse(row.payloadJson ?? "{}") as Record<string, unknown>;
    payload["replayRequestedAt"] = Date.now();
    payload["replayRequestedBy"] = request.authContext?.userId ?? "unknown";

    const updated = await runtime.store.updateVersioned<DeadLetterRow>(TABLE_NAMES.DEAD_LETTERS, row.id, row.version, {
      ...row,
      payloadJson: JSON.stringify(payload),
      updatedAt: Date.now()
    });

    await writeAdminAudit(runtime, request, {
      actionType: "dead_letter_replay",
      targetType: "dead_letter",
      targetId: deadLetterId,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload,
      result: updated ? "success" : "failed"
    });

    if (!updated) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
  });

  app.get("/api/admin/ops/workflows", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { runId?: string; state?: string };
    const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.WORKFLOW_STEP_EVENTS, [], 1000);
    const rows = result.rows;
    const filtered = rows.filter((row) => {
      if (query.runId && String(row["workflowRunId"] ?? "") !== query.runId) return false;
      if (query.state && String(row["state"] ?? "") !== query.state) return false;
      return true;
    });
    return reply.code(200).send({ ...applyCursor(filtered, query), ...(result.error ? { error: result.error } : {}) });
  });

  app.get("/api/admin/ops/circuit-breakers", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery;
    const result = await safeQueryMany<CircuitRow>(runtime, TABLE_NAMES.CIRCUIT_BREAKER_STATE, [], 1000);
    return reply.code(200).send({ ...applyCursor(result.rows, query), ...(result.error ? { error: result.error } : {}) });
  });

  app.post("/api/admin/ops/circuit-breakers/:circuit/reset", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;

    const circuit = decodeURIComponent((request.params as { circuit?: string }).circuit ?? "");
    const body = (request.body ?? {}) as { reason?: string; confirmation?: string };
    if (!circuit) return reply.code(400).send({ error: "circuit required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const row = (await runtime.store.queryMany<CircuitRow>(TABLE_NAMES.CIRCUIT_BREAKER_STATE, [{ field: "circuit", op: "eq", value: circuit }], 1))[0];
    if (!row) return reply.code(404).send({ error: "Circuit not found" });

    const updated = await runtime.store.updateVersioned<CircuitRow>(TABLE_NAMES.CIRCUIT_BREAKER_STATE, row.id, row.version, {
      ...row,
      failures: 0,
      status: "CLOSED",
      updatedAt: Date.now()
    });

    await writeAdminAudit(runtime, request, {
      actionType: "circuit_reset",
      targetType: "circuit",
      targetId: circuit,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { before: row, after: { failures: 0, status: "CLOSED" } },
      result: updated ? "success" : "failed"
    });

    if (!updated) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
  });

  app.get("/api/admin/ops/feature-flags", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery;
    const result = await safeQueryMany<FeatureFlagRow>(runtime, TABLE_NAMES.FEATURE_FLAGS, [], 1000);
    return reply.code(200).send({ ...applyCursor(result.rows, query), ...(result.error ? { error: result.error } : {}) });
  });

  app.post("/api/admin/ops/feature-flags/:key/toggle", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const key = decodeURIComponent((request.params as { key?: string }).key ?? "");
    if (!key) return reply.code(400).send({ error: "key required" });

    const row = (await runtime.store.queryMany<FeatureFlagRow>(TABLE_NAMES.FEATURE_FLAGS, [{ field: "flagKey", op: "eq", value: key }], 1))[0];
    const now = Date.now();

    if (!row) {
      await runtime.store.insert(TABLE_NAMES.FEATURE_FLAGS, {
        id: randomUUID(),
        flagKey: key,
        enabled: true,
        source: "admin_dashboard",
        createdAt: now,
        updatedAt: now,
        version: 1
      });
      return reply.code(200).send({ ok: true, flagKey: key, enabled: true });
    }

    const nextEnabled = !row.enabled;
    const updated = await runtime.store.updateVersioned<FeatureFlagRow>(TABLE_NAMES.FEATURE_FLAGS, row.id, row.version, {
      ...row,
      enabled: nextEnabled,
      source: "admin_dashboard",
      updatedAt: now
    });

    if (!updated) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true, flagKey: key, enabled: nextEnabled });
  });

  app.get("/api/admin/actions/audit", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery;
    const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.ADMIN_ACTION_AUDIT, [], 1000);
    return reply.code(200).send({ ...applyCursor(result.rows, query), ...(result.error ? { error: result.error } : {}) });
  });

  app.post("/api/admin/actions/execute", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;

    const body = (request.body ?? {}) as {
      actionType?: string;
      targetType?: string;
      targetId?: string;
      reason?: string;
      confirmation?: string;
      payload?: Record<string, unknown>;
    };

    if (!body.actionType || !body.targetType || !body.targetId) {
      return reply.code(400).send({ error: "actionType, targetType and targetId are required" });
    }
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    let result: "success" | "failed" = "success";
    const payload = body.payload ?? {};

    try {
      if (body.actionType === "feature_flag_toggle" && body.targetType === "feature_flag") {
        const key = body.targetId;
        const row = (await runtime.store.queryMany<FeatureFlagRow>(TABLE_NAMES.FEATURE_FLAGS, [{ field: "flagKey", op: "eq", value: key }], 1))[0];
        if (!row) {
          await runtime.store.insert(TABLE_NAMES.FEATURE_FLAGS, {
            id: randomUUID(),
            flagKey: key,
            enabled: true,
            source: "admin_action_execute",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1
          });
        } else {
          await runtime.store.updateVersioned<FeatureFlagRow>(TABLE_NAMES.FEATURE_FLAGS, row.id, row.version, {
            ...row,
            enabled: !row.enabled,
            source: "admin_action_execute",
            updatedAt: Date.now()
          });
        }
      } else {
        result = "failed";
      }

      await writeAdminAudit(runtime, request, {
        actionType: body.actionType,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason ?? "",
        confirmation: body.confirmation ?? "",
        payload,
        result
      });
    } catch {
      result = "failed";
      await writeAdminAudit(runtime, request, {
        actionType: body.actionType,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason ?? "",
        confirmation: body.confirmation ?? "",
        payload,
        result
      });
      return reply.code(500).send({ error: "Action failed" });
    }

    if (result === "failed") {
      return reply.code(400).send({ error: "Unsupported action type/target" });
    }

    return reply.code(200).send({ ok: true });
  });
}
