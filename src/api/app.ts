import { existsSync } from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { registerChatRoutes } from "@api/routes/chat-routes";
import { registerHealthRoutes } from "@api/routes/health-routes";
import { registerAuthRoutes } from "@api/routes/auth-routes";
import { registerPartnerRoutes } from "@api/routes/partner-routes";
import { registerTestRoutes } from "@api/routes/test-routes";
import { registerWhatsAppRoutes } from "@api/routes/whatsapp-routes";
import { registerAdminRoutes } from "@api/routes/admin-routes";
import { registerWhatsAppPlatformRoutes } from "@modules/whatsapp/api/routes";
import { traceIdMiddleware } from "@api/middleware/trace-id";
import { createRuntime, type RuntimeContainer } from "@modules/internal/runtime";
import { TABLE_NAMES } from "@shared/constants";

export interface AppContext {
  app: FastifyInstance;
  runtime: RuntimeContainer;
}

/**
 * Builds Fastify app with runtime dependencies.
 * @returns App context
 */
export async function createApp(): Promise<AppContext> {
  const runtime = createRuntime();
  const app = Fastify({ logger: false });
  const requestStartTime = new Map<string, number>();

  await app.register(fastifyRateLimit, {
    global: true,
    max: runtime.env.RATE_LIMIT_MAX,
    timeWindow: runtime.env.RATE_LIMIT_WINDOW_MS
  });

  app.addHook("onRequest", traceIdMiddleware);
  app.addHook("onRequest", async (request) => {
    requestStartTime.set(request.id, Date.now());
  });
  app.addHook("onResponse", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    const now = Date.now();
    const traceId = request.headers["x-trace-id"]?.toString() ?? "";
    const startedAt = requestStartTime.get(request.id) ?? now;
    requestStartTime.delete(request.id);
    const event = {
      id: now.toString(),
      eventId: request.id,
      requestId: request.id,
      route: request.url,
      method: request.method,
      status: reply.statusCode,
      latencyMs: Math.max(0, now - startedAt),
      level: reply.statusCode >= 500 ? "error" : (reply.statusCode >= 400 ? "warn" : "info"),
      errorCode: reply.statusCode >= 400 ? `HTTP_${reply.statusCode}` : "",
      errorMessage: reply.statusCode >= 400 ? "Request failed" : "",
      traceId,
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    try {
      await runtime.store.insert(TABLE_NAMES.API_EVENT_LOG, event);
    } catch {
      // Swallow to avoid affecting request path on logging failures.
    }
  });

  const dashboardRoot = path.resolve(process.cwd(), "dist/dashboard");
  if (existsSync(dashboardRoot)) {
    await app.register(fastifyStatic, {
      root: dashboardRoot,
      prefix: "/dashboard/",
      wildcard: false
    });

    app.get("/dashboard", async (_request, reply) => {
      return reply.sendFile("index.html");
    });

    app.get("/dashboard/*", async (_request, reply) => {
      return reply.sendFile("index.html");
    });
  }

  await registerHealthRoutes(app, runtime);
  await registerAuthRoutes(app, runtime);
  await registerPartnerRoutes(app, runtime);
  await registerChatRoutes(app, runtime);
  await registerTestRoutes(app, runtime);
  await registerWhatsAppRoutes(app, runtime);
  await registerAdminRoutes(app, runtime);
  if (runtime.env.FEATURE_LLIGHT_WA_PLATFORM_ENABLED) {
    await registerWhatsAppPlatformRoutes(app, runtime);
  }

  return { app, runtime };
}
