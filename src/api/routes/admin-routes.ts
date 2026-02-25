import { createHash, randomUUID, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAdmin } from "@api/middleware/auth";
import { waCampaignCreateSchema, waCampaignRunSchema, waTemplateDraftSchema } from "@api/schema/whatsapp-platform";
import { AppError } from "@lib/errors/app-error";
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

interface TemplateRow {
  templateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  createdAt: number;
  updatedAt: number;
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

interface UserProfileRow {
  id: string;
  version: number;
  userId: string;
  phoneNumber?: string;
  name?: string;
  locale?: string;
  status?: string;
  metadataJson?: string;
  createdAt: number;
  updatedAt: number;
}

interface UserRoleRow {
  id: string;
  version: number;
  roleAssignmentId: string;
  userId: string;
  role: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SessionTokenRow {
  id: string;
  version: number;
  sessionId: string;
  userId: string;
  expiresAt: number;
  revoked: boolean;
  createdAt: number;
  updatedAt: number;
}

interface PartnerRow {
  id: string;
  version: number;
  partnerId: string;
  name: string;
  apiKeyHash?: string;
  isActive?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface PropertyRow {
  id: string;
  version: number;
  propertyId: string;
  partnerId?: string;
  title?: string;
  address?: string;
  description?: string;
  price?: number;
  beds?: number;
  baths?: number;
  createdAt: number;
  updatedAt: number;
}

interface NotificationRow {
  id: string;
  version: number;
  title: string;
  message: string;
  audience?: string;
  priority?: string;
  status?: string;
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
    if (error instanceof AppError) {
      const detail = typeof error.payload === "object" && error.payload !== null && "detail" in error.payload
        ? String((error.payload as Record<string, unknown>)["detail"] ?? "")
        : "";
      return { rows: [], error: detail ? `${error.message} | ${detail}` : error.message };
    }
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

function buildPage<T extends { createdAt?: number; updatedAt?: number }>(
  rows: T[],
  query: CursorQuery,
  error?: string
): { rows: T[]; nextCursor: string | null; totalApprox: number; error?: string } {
  const paged = applyCursor(rows, query);
  return {
    rows: paged.rows,
    nextCursor: paged.nextCursor ?? null,
    totalApprox: rows.length,
    ...(error ? { error } : {})
  };
}

function getField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value === null || typeof value === "undefined") continue;
    return String(value);
  }
  return "";
}

function getNumberField(row: Record<string, unknown>, ...keys: string[]): number {
  const value = getField(row, ...keys);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function includesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
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
      health: {
        store: readiness.checks.store,
        queue: readiness.checks.queue,
        ready: readiness.ready
      },
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
      ].filter(Boolean),
      alerts: [
        ...((waPerformance.failed > 0) ? ["WHATSAPP_FAILURES_PRESENT"] : []),
        ...((apiEvents.error || webhookEvents.error || deadLetters.error || workflows.error || circuits.error || flags.error)
          ? ["STORE_QUERY_ERRORS_PRESENT"]
          : []),
        ...(readiness.ready ? [] : ["READINESS_DEGRADED"])
      ]
    });
  });

  app.get("/api/admin/diagnostics/store", { preHandler: requireAdmin(runtime) }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const tablesToCheck = [
      TABLE_NAMES.API_EVENT_LOG,
      TABLE_NAMES.WEBHOOK_EVENT_LOG,
      TABLE_NAMES.DEAD_LETTERS,
      TABLE_NAMES.WORKFLOW_STEP_EVENTS,
      TABLE_NAMES.CIRCUIT_BREAKER_STATE,
      TABLE_NAMES.FEATURE_FLAGS,
      TABLE_NAMES.WA_TEMPLATES,
      TABLE_NAMES.WA_CAMPAIGNS,
      TABLE_NAMES.ADMIN_ACTION_AUDIT
    ];

    const checks = await Promise.all(tablesToCheck.map(async (table) => {
      try {
        const rows = await runtime.store.queryMany<Record<string, unknown>>(table, [], 1);
        return { table, ok: true, sampleRows: rows.length };
      } catch (error) {
        if (error instanceof AppError) {
          const detail = typeof error.payload === "object" && error.payload !== null && "detail" in error.payload
            ? String((error.payload as Record<string, unknown>)["detail"] ?? "")
            : undefined;
          return { table, ok: false, error: error.message, ...(detail ? { detail } : {}) };
        }
        return { table, ok: false, error: error instanceof Error ? error.message : "unknown_store_error" };
      }
    }));

    return reply.code(200).send({
      version: runtime.getBuildVersion(),
      storeMode: runtime.env.SPACETIME_STORE_MODE,
      dbName: runtime.env.SPACETIMEDB_DB_NAME,
      endpoint: runtime.env.SPACETIMEDB_HTTP_URL,
      authTokenPresent: runtime.env.SPACETIMEDB_AUTH_TOKEN?.trim().length ? true : false,
      checks,
      tableProvisioning: runtime.getTableProvisioningReport()
    });
  });

  app.get("/api/admin/search", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { q?: string; scope?: string };
    const search = (query.q ?? "").trim();
    const scope = (query.scope ?? "").trim().toLowerCase();
    const allScopes = new Set(
      (scope.length > 0 ? scope.split(",") : [
        "users",
        "campaigns",
        "templates",
        "api_logs",
        "webhook_logs",
        "dead_letters",
        "workflows",
        "flags",
        "audit",
        "partners",
        "properties",
        "notifications"
      ]).map((item) => item.trim()).filter(Boolean)
    );

    const matches = (value: string): boolean => (search.length === 0 ? true : includesText(value, search));
    const rows: Array<{ scope: string; id: string; title: string; subtitle: string; createdAt: number; meta: Record<string, unknown> }> = [];

    const pushRow = (row: { scope: string; id: string; title: string; subtitle: string; createdAt: number; meta: Record<string, unknown> }) => {
      rows.push(row);
    };

    if (allScopes.has("users")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.USER_PROFILES, [], 300);
      for (const row of result.rows) {
        const userId = getField(row, "userId", "user_id", "id");
        const name = getField(row, "name");
        const phone = getField(row, "phoneNumber", "phone_number");
        if (!matches(`${userId} ${name} ${phone}`)) continue;
        pushRow({
          scope: "users",
          id: userId || getField(row, "id"),
          title: name || userId || "Unknown user",
          subtitle: phone || userId,
          createdAt: getNumberField(row, "createdAt", "created_at", "updatedAt", "updated_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("campaigns")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.WA_CAMPAIGNS, [], 300);
      for (const row of result.rows) {
        const campaignId = getField(row, "campaignId", "campaign_id");
        const name = getField(row, "name");
        const status = getField(row, "status");
        if (!matches(`${campaignId} ${name} ${status}`)) continue;
        pushRow({
          scope: "campaigns",
          id: campaignId || getField(row, "id"),
          title: name || campaignId || "Campaign",
          subtitle: status,
          createdAt: getNumberField(row, "updatedAt", "updated_at", "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("templates")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.WA_TEMPLATES, [], 300);
      for (const row of result.rows) {
        const templateId = getField(row, "templateId", "template_id");
        const name = getField(row, "name");
        const status = getField(row, "status");
        if (!matches(`${templateId} ${name} ${status}`)) continue;
        pushRow({
          scope: "templates",
          id: templateId || getField(row, "id"),
          title: name || templateId || "Template",
          subtitle: status,
          createdAt: getNumberField(row, "updatedAt", "updated_at", "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("api_logs")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.API_EVENT_LOG, [], 300);
      for (const row of result.rows) {
        const route = getField(row, "route");
        const method = getField(row, "method");
        const status = getField(row, "status");
        if (!matches(`${route} ${method} ${status}`)) continue;
        pushRow({
          scope: "api_logs",
          id: getField(row, "eventId", "event_id", "requestId", "request_id", "id"),
          title: `${method || "METHOD"} ${route || "/"}`,
          subtitle: `status=${status || "-"}`,
          createdAt: getNumberField(row, "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("webhook_logs")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.WEBHOOK_EVENT_LOG, [], 300);
      for (const row of result.rows) {
        const eventType = getField(row, "eventType", "event_type");
        const status = getField(row, "status");
        const messageId = getField(row, "messageId", "message_id");
        if (!matches(`${eventType} ${status} ${messageId}`)) continue;
        pushRow({
          scope: "webhook_logs",
          id: getField(row, "eventId", "event_id", "id"),
          title: eventType || "Webhook event",
          subtitle: `${status || "-"} ${messageId}`,
          createdAt: getNumberField(row, "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("dead_letters")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.DEAD_LETTERS, [], 300);
      for (const row of result.rows) {
        const scopeValue = getField(row, "scope");
        const operation = getField(row, "operation");
        const deadLetterId = getField(row, "deadLetterId", "dead_letter_id");
        if (!matches(`${scopeValue} ${operation} ${deadLetterId}`)) continue;
        pushRow({
          scope: "dead_letters",
          id: deadLetterId || getField(row, "id"),
          title: `${scopeValue || "scope"}:${operation || "operation"}`,
          subtitle: deadLetterId,
          createdAt: getNumberField(row, "updatedAt", "updated_at", "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("workflows")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.WORKFLOW_STEP_EVENTS, [], 300);
      for (const row of result.rows) {
        const runId = getField(row, "workflowRunId", "workflow_run_id");
        const stepId = getField(row, "stepId", "step_id");
        const state = getField(row, "state");
        if (!matches(`${runId} ${stepId} ${state}`)) continue;
        pushRow({
          scope: "workflows",
          id: getField(row, "eventId", "event_id", "id"),
          title: `${runId || "run"} / ${stepId || "step"}`,
          subtitle: state || "-",
          createdAt: getNumberField(row, "updatedAt", "updated_at", "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("flags")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.FEATURE_FLAGS, [], 300);
      for (const row of result.rows) {
        const key = getField(row, "flagKey", "flag_key");
        const source = getField(row, "source");
        const enabled = getField(row, "enabled");
        if (!matches(`${key} ${source} ${enabled}`)) continue;
        pushRow({
          scope: "flags",
          id: key || getField(row, "id"),
          title: key || "feature flag",
          subtitle: `${enabled} via ${source}`,
          createdAt: getNumberField(row, "updatedAt", "updated_at", "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("audit")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.ADMIN_ACTION_AUDIT, [], 300);
      for (const row of result.rows) {
        const action = getField(row, "actionType", "action_type");
        const actor = getField(row, "actorUserId", "actor_user_id");
        const target = getField(row, "targetId", "target_id");
        if (!matches(`${action} ${actor} ${target}`)) continue;
        pushRow({
          scope: "audit",
          id: getField(row, "actionId", "action_id", "id"),
          title: action || "admin action",
          subtitle: `${actor} -> ${target}`,
          createdAt: getNumberField(row, "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("partners")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.PARTNERS, [], 300);
      for (const row of result.rows) {
        const partnerId = getField(row, "partnerId", "partner_id");
        const name = getField(row, "name");
        if (!matches(`${partnerId} ${name}`)) continue;
        pushRow({
          scope: "partners",
          id: partnerId || getField(row, "id"),
          title: name || partnerId || "Partner",
          subtitle: partnerId,
          createdAt: getNumberField(row, "updatedAt", "updated_at", "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("properties")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.PROPERTIES, [], 300);
      for (const row of result.rows) {
        const propertyId = getField(row, "propertyId", "property_id");
        const title = getField(row, "title");
        const address = getField(row, "address");
        if (!matches(`${propertyId} ${title} ${address}`)) continue;
        pushRow({
          scope: "properties",
          id: propertyId || getField(row, "id"),
          title: title || propertyId || "Property",
          subtitle: address,
          createdAt: getNumberField(row, "updatedAt", "updated_at", "createdAt", "created_at"),
          meta: row
        });
      }
    }

    if (allScopes.has("notifications")) {
      const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.NOTIFICATIONS, [], 300);
      for (const row of result.rows) {
        const title = getField(row, "title");
        const audience = getField(row, "audience");
        const status = getField(row, "status");
        if (!matches(`${title} ${audience} ${status}`)) continue;
        pushRow({
          scope: "notifications",
          id: getField(row, "id"),
          title: title || "Notification",
          subtitle: `${audience} / ${status}`,
          createdAt: getNumberField(row, "updatedAt", "updated_at", "createdAt", "created_at"),
          meta: row
        });
      }
    }

    return reply.code(200).send(buildPage(rows, query));
  });

  app.get("/api/admin/users", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { query?: string; role?: string; status?: string };
    const search = (query.query ?? "").trim().toLowerCase();
    const roleFilter = (query.role ?? "").trim().toLowerCase();
    const statusFilter = (query.status ?? "").trim().toLowerCase();
    const [profilesResult, rolesResult, sessionsResult] = await Promise.all([
      safeQueryMany<UserProfileRow>(runtime, TABLE_NAMES.USER_PROFILES, [], 1000),
      safeQueryMany<UserRoleRow>(runtime, TABLE_NAMES.USER_ROLES, [], 1000),
      safeQueryMany<SessionTokenRow>(runtime, TABLE_NAMES.SESSION_TOKENS, [], 1000)
    ]);

    const rolesByUser = new Map<string, string[]>();
    for (const roleRow of rolesResult.rows) {
      const roles = rolesByUser.get(roleRow.userId) ?? [];
      if (roleRow.active !== false) roles.push(roleRow.role);
      rolesByUser.set(roleRow.userId, roles);
    }

    const sessionCountByUser = new Map<string, number>();
    for (const session of sessionsResult.rows) {
      if (session.revoked) continue;
      sessionCountByUser.set(session.userId, (sessionCountByUser.get(session.userId) ?? 0) + 1);
    }

    const rows = profilesResult.rows
      .map((profile) => {
        const roles = rolesByUser.get(profile.userId) ?? ["user"];
        return {
          userId: profile.userId,
          name: profile.name ?? "",
          phoneNumber: profile.phoneNumber ?? "",
          locale: profile.locale ?? "",
          status: profile.status ?? "active",
          roles,
          activeSessions: sessionCountByUser.get(profile.userId) ?? 0,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt
        };
      })
      .filter((row) => {
        if (search.length > 0) {
          const haystack = `${row.userId} ${row.name} ${row.phoneNumber} ${row.locale}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        if (roleFilter && !row.roles.map((role) => role.toLowerCase()).includes(roleFilter)) return false;
        if (statusFilter && row.status.toLowerCase() !== statusFilter) return false;
        return true;
      });

    const error = [profilesResult.error, rolesResult.error, sessionsResult.error].filter(Boolean).join(" | ");
    return reply.code(200).send(buildPage(rows, query, error.length > 0 ? error : undefined));
  });

  app.get("/api/admin/users/:userId", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = decodeURIComponent((request.params as { userId?: string }).userId ?? "");
    if (!userId) return reply.code(400).send({ error: "userId required" });

    const [profilesResult, rolesResult, sessionsResult] = await Promise.all([
      safeQueryMany<UserProfileRow>(runtime, TABLE_NAMES.USER_PROFILES, [], 1000),
      safeQueryMany<UserRoleRow>(runtime, TABLE_NAMES.USER_ROLES, [], 1000),
      safeQueryMany<SessionTokenRow>(runtime, TABLE_NAMES.SESSION_TOKENS, [], 1000)
    ]);
    const profile = profilesResult.rows.find((item) => item.userId === userId);
    if (!profile) return reply.code(404).send({ error: "User not found" });

    const roles = rolesResult.rows.filter((item) => item.userId === userId && item.active !== false).map((item) => item.role);
    const sessions = sessionsResult.rows
      .filter((item) => item.userId === userId)
      .map((item) => ({
        sessionId: item.sessionId,
        expiresAt: item.expiresAt,
        revoked: item.revoked,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

    return reply.code(200).send({
      userId: profile.userId,
      name: profile.name ?? "",
      phoneNumber: profile.phoneNumber ?? "",
      locale: profile.locale ?? "",
      status: profile.status ?? "active",
      roles: roles.length > 0 ? roles : ["user"],
      metadataJson: profile.metadataJson ?? "{}",
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      sessions
    });
  });

  app.patch("/api/admin/users/:userId", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const userId = decodeURIComponent((request.params as { userId?: string }).userId ?? "");
    if (!userId) return reply.code(400).send({ error: "userId required" });

    const body = (request.body ?? {}) as {
      name?: string;
      locale?: string;
      phoneNumber?: string;
      metadataJson?: string;
      reason?: string;
      confirmation?: string;
    };
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const profile = (await runtime.store.queryMany<UserProfileRow>(TABLE_NAMES.USER_PROFILES, [], 1000)).find((item) => item.userId === userId);
    if (!profile) return reply.code(404).send({ error: "User not found" });

    const next: UserProfileRow = {
      ...profile,
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.locale === "string" ? { locale: body.locale } : {}),
      ...(typeof body.phoneNumber === "string" ? { phoneNumber: body.phoneNumber } : {}),
      ...(typeof body.metadataJson === "string" ? { metadataJson: body.metadataJson } : {}),
      updatedAt: Date.now()
    };
    const ok = await runtime.store.updateVersioned(TABLE_NAMES.USER_PROFILES, profile.id, profile.version, next);
    await writeAdminAudit(runtime, request, {
      actionType: "user_update",
      targetType: "user",
      targetId: userId,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { before: profile, after: next },
      result: ok ? "success" : "failed"
    });
    if (!ok) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
  });

  app.post("/api/admin/users/:userId/roles", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const userId = decodeURIComponent((request.params as { userId?: string }).userId ?? "");
    const body = (request.body ?? {}) as { role?: string; mode?: "grant" | "revoke"; reason?: string; confirmation?: string };
    if (!userId || !body.role || !body.mode) return reply.code(400).send({ error: "userId, role and mode are required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const roles = await runtime.store.queryMany<UserRoleRow>(TABLE_NAMES.USER_ROLES, [], 1000);
    const existing = roles.find((item) => item.userId === userId && item.role === body.role);
    const now = Date.now();
    let ok = true;
    if (!existing) {
      await runtime.store.insert(TABLE_NAMES.USER_ROLES, {
        id: randomUUID(),
        roleAssignmentId: randomUUID(),
        userId,
        role: body.role,
        active: body.mode === "grant",
        createdAt: now,
        updatedAt: now,
        version: 1
      });
    } else {
      ok = await runtime.store.updateVersioned(TABLE_NAMES.USER_ROLES, existing.id, existing.version, {
        ...existing,
        active: body.mode === "grant",
        updatedAt: now
      });
    }

    await writeAdminAudit(runtime, request, {
      actionType: body.mode === "grant" ? "user_role_grant" : "user_role_revoke",
      targetType: "user_role",
      targetId: `${userId}:${body.role}`,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { role: body.role, mode: body.mode },
      result: ok ? "success" : "failed"
    });
    if (!ok) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
  });

  app.post("/api/admin/users/:userId/disable", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const userId = decodeURIComponent((request.params as { userId?: string }).userId ?? "");
    const body = (request.body ?? {}) as { reason?: string; confirmation?: string };
    if (!userId) return reply.code(400).send({ error: "userId required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const profile = (await runtime.store.queryMany<UserProfileRow>(TABLE_NAMES.USER_PROFILES, [], 1000)).find((item) => item.userId === userId);
    if (!profile) return reply.code(404).send({ error: "User not found" });

    const ok = await runtime.store.updateVersioned(TABLE_NAMES.USER_PROFILES, profile.id, profile.version, {
      ...profile,
      status: "disabled",
      updatedAt: Date.now()
    });
    await writeAdminAudit(runtime, request, {
      actionType: "user_disable",
      targetType: "user",
      targetId: userId,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { previousStatus: profile.status ?? "active", nextStatus: "disabled" },
      result: ok ? "success" : "failed"
    });
    if (!ok) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
  });

  app.post("/api/admin/users/:userId/enable", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const userId = decodeURIComponent((request.params as { userId?: string }).userId ?? "");
    const body = (request.body ?? {}) as { reason?: string; confirmation?: string };
    if (!userId) return reply.code(400).send({ error: "userId required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const profile = (await runtime.store.queryMany<UserProfileRow>(TABLE_NAMES.USER_PROFILES, [], 1000)).find((item) => item.userId === userId);
    if (!profile) return reply.code(404).send({ error: "User not found" });

    const ok = await runtime.store.updateVersioned(TABLE_NAMES.USER_PROFILES, profile.id, profile.version, {
      ...profile,
      status: "active",
      updatedAt: Date.now()
    });
    await writeAdminAudit(runtime, request, {
      actionType: "user_enable",
      targetType: "user",
      targetId: userId,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { previousStatus: profile.status ?? "disabled", nextStatus: "active" },
      result: ok ? "success" : "failed"
    });
    if (!ok) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
  });

  app.get("/api/admin/users/:userId/sessions", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = decodeURIComponent((request.params as { userId?: string }).userId ?? "");
    if (!userId) return reply.code(400).send({ error: "userId required" });
    const sessions = (await runtime.store.queryMany<SessionTokenRow>(TABLE_NAMES.SESSION_TOKENS, [], 1000)).filter((item) => item.userId === userId);
    return reply.code(200).send({
      rows: sessions.map((item) => ({
        sessionId: item.sessionId,
        revoked: item.revoked,
        expiresAt: item.expiresAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })),
      nextCursor: null,
      totalApprox: sessions.length
    });
  });

  app.post("/api/admin/users/:userId/sessions/revoke-all", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const userId = decodeURIComponent((request.params as { userId?: string }).userId ?? "");
    const body = (request.body ?? {}) as { reason?: string; confirmation?: string };
    if (!userId) return reply.code(400).send({ error: "userId required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const sessions = (await runtime.store.queryMany<SessionTokenRow>(TABLE_NAMES.SESSION_TOKENS, [], 1000)).filter((item) => item.userId === userId && !item.revoked);
    let revoked = 0;
    for (const session of sessions) {
      const ok = await runtime.store.updateVersioned(TABLE_NAMES.SESSION_TOKENS, session.id, session.version, {
        ...session,
        revoked: true,
        updatedAt: Date.now()
      });
      if (ok) revoked += 1;
    }

    await writeAdminAudit(runtime, request, {
      actionType: "user_sessions_revoke_all",
      targetType: "user",
      targetId: userId,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { revoked },
      result: "success"
    });

    return reply.code(200).send({ ok: true, revoked });
  });

  app.get("/api/admin/partners", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { query?: string };
    const search = (query.query ?? "").trim().toLowerCase();
    const result = await safeQueryMany<PartnerRow>(runtime, TABLE_NAMES.PARTNERS, [], 1000);
    const rows = result.rows.filter((row) => {
      if (!search) return true;
      return includesText(`${row.partnerId} ${row.name}`, search);
    });
    return reply.code(200).send(buildPage(rows, query, result.error));
  });

  app.patch("/api/admin/partners/:partnerId", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const partnerId = decodeURIComponent((request.params as { partnerId?: string }).partnerId ?? "");
    const body = (request.body ?? {}) as { name?: string; isActive?: boolean; reason?: string; confirmation?: string };
    if (!partnerId) return reply.code(400).send({ error: "partnerId required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const row = (await runtime.store.queryMany<PartnerRow>(TABLE_NAMES.PARTNERS, [], 1000)).find((item) => item.partnerId === partnerId || item.id === partnerId);
    if (!row) return reply.code(404).send({ error: "Partner not found" });
    const next = {
      ...row,
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      updatedAt: Date.now()
    };
    const ok = await runtime.store.updateVersioned(TABLE_NAMES.PARTNERS, row.id, row.version, next);
    await writeAdminAudit(runtime, request, {
      actionType: "partner_update",
      targetType: "partner",
      targetId: partnerId,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { before: row, after: next },
      result: ok ? "success" : "failed"
    });
    if (!ok) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
  });

  app.get("/api/admin/properties", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { query?: string };
    const search = (query.query ?? "").trim().toLowerCase();
    const result = await safeQueryMany<PropertyRow>(runtime, TABLE_NAMES.PROPERTIES, [], 1000);
    const rows = result.rows.filter((row) => {
      if (!search) return true;
      return includesText(`${row.propertyId} ${row.title ?? ""} ${row.address ?? ""}`, search);
    });
    return reply.code(200).send(buildPage(rows, query, result.error));
  });

  app.patch("/api/admin/properties/:propertyId", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const propertyId = decodeURIComponent((request.params as { propertyId?: string }).propertyId ?? "");
    const body = (request.body ?? {}) as {
      title?: string;
      address?: string;
      description?: string;
      price?: number;
      beds?: number;
      baths?: number;
      reason?: string;
      confirmation?: string;
    };
    if (!propertyId) return reply.code(400).send({ error: "propertyId required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const row = (await runtime.store.queryMany<PropertyRow>(TABLE_NAMES.PROPERTIES, [], 1000)).find((item) => item.propertyId === propertyId || item.id === propertyId);
    if (!row) return reply.code(404).send({ error: "Property not found" });
    const next = {
      ...row,
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.address === "string" ? { address: body.address } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(typeof body.price === "number" ? { price: body.price } : {}),
      ...(typeof body.beds === "number" ? { beds: body.beds } : {}),
      ...(typeof body.baths === "number" ? { baths: body.baths } : {}),
      updatedAt: Date.now()
    };
    const ok = await runtime.store.updateVersioned(TABLE_NAMES.PROPERTIES, row.id, row.version, next);
    await writeAdminAudit(runtime, request, {
      actionType: "property_update",
      targetType: "property",
      targetId: propertyId,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { before: row, after: next },
      result: ok ? "success" : "failed"
    });
    if (!ok) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
  });

  app.get("/api/admin/notifications", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { query?: string };
    const search = (query.query ?? "").trim().toLowerCase();
    const result = await safeQueryMany<NotificationRow>(runtime, TABLE_NAMES.NOTIFICATIONS, [], 1000);
    const rows = result.rows.filter((row) => {
      if (!search) return true;
      return includesText(`${row.title} ${row.message} ${row.status ?? ""}`, search);
    });
    return reply.code(200).send(buildPage(rows, query, result.error));
  });

  app.patch("/api/admin/notifications/:id", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireCsrf(request, reply)) return;
    const id = decodeURIComponent((request.params as { id?: string }).id ?? "");
    const body = (request.body ?? {}) as { title?: string; message?: string; audience?: string; priority?: string; status?: string; reason?: string; confirmation?: string };
    if (!id) return reply.code(400).send({ error: "id required" });
    if (!requireDestructiveSafety(runtime, reply, body)) return;

    const row = (await runtime.store.queryMany<NotificationRow>(TABLE_NAMES.NOTIFICATIONS, [], 1000)).find((item) => item.id === id);
    if (!row) return reply.code(404).send({ error: "Notification not found" });
    const next = {
      ...row,
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.message === "string" ? { message: body.message } : {}),
      ...(typeof body.audience === "string" ? { audience: body.audience } : {}),
      ...(typeof body.priority === "string" ? { priority: body.priority } : {}),
      ...(typeof body.status === "string" ? { status: body.status } : {}),
      updatedAt: Date.now()
    };
    const ok = await runtime.store.updateVersioned(TABLE_NAMES.NOTIFICATIONS, row.id, row.version, next);
    await writeAdminAudit(runtime, request, {
      actionType: "notification_update",
      targetType: "notification",
      targetId: id,
      reason: body.reason ?? "",
      confirmation: body.confirmation ?? "",
      payload: { before: row, after: next },
      result: ok ? "success" : "failed"
    });
    if (!ok) return reply.code(409).send({ error: "Version conflict" });
    return reply.code(200).send({ ok: true });
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
    return reply.code(200).send(buildPage(filtered, query, result.error));
  });

  app.get("/api/admin/logs/webhooks", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { status?: string };
    const result = await safeQueryMany<Record<string, unknown>>(runtime, TABLE_NAMES.WEBHOOK_EVENT_LOG, [], 1000);
    const rows = result.rows;
    const filtered = rows.filter((row) => !query.status || String(row["status"] ?? "") === query.status);
    return reply.code(200).send(buildPage(filtered, query, result.error));
  });

  app.get("/api/admin/whatsapp/templates", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery & { locale?: string };
    try {
      const templates = await fetchTemplateCatalog(runtime, query.locale);
      const rows: TemplateRow[] = templates.map((template) => ({
        templateId: template.templateId,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }));
      return reply.code(200).send(buildPage(rows, query));
    } catch (error) {
      return reply.code(200).send(buildPage<TemplateRow>([], query, error instanceof Error ? error.message : "templates_query_failed"));
    }
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
    return reply.code(200).send(buildPage(filtered, query, result.error));
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
    return reply.code(200).send(buildPage(filtered, query, result.error));
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
    return reply.code(200).send(buildPage(filtered, query, result.error));
  });

  app.get("/api/admin/ops/circuit-breakers", { preHandler: requireAdmin(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as CursorQuery;
    const result = await safeQueryMany<CircuitRow>(runtime, TABLE_NAMES.CIRCUIT_BREAKER_STATE, [], 1000);
    return reply.code(200).send(buildPage(result.rows, query, result.error));
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
    return reply.code(200).send(buildPage(result.rows, query, result.error));
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
    return reply.code(200).send(buildPage(result.rows, query, result.error));
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
