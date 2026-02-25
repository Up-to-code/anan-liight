import Fastify, { type FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerChatRoutes } from "@api/routes/chat-routes";
import { registerHealthRoutes } from "@api/routes/health-routes";
import { registerAuthRoutes } from "@api/routes/auth-routes";
import { registerPartnerRoutes } from "@api/routes/partner-routes";
import { registerTestRoutes } from "@api/routes/test-routes";
import { registerWhatsAppRoutes } from "@api/routes/whatsapp-routes";
import { registerWhatsAppPlatformRoutes } from "@modules/whatsapp/api/routes";
import { traceIdMiddleware } from "@api/middleware/trace-id";
import { createRuntime, type RuntimeContainer } from "@modules/internal/runtime";

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

  await app.register(fastifyRateLimit, {
    global: true,
    max: runtime.env.RATE_LIMIT_MAX,
    timeWindow: runtime.env.RATE_LIMIT_WINDOW_MS
  });

  app.addHook("onRequest", traceIdMiddleware);

  await registerHealthRoutes(app, runtime);
  await registerAuthRoutes(app, runtime);
  await registerPartnerRoutes(app, runtime);
  await registerChatRoutes(app, runtime);
  await registerTestRoutes(app, runtime);
  await registerWhatsAppRoutes(app, runtime);
  if (runtime.env.FEATURE_LLIGHT_WA_PLATFORM_ENABLED) {
    await registerWhatsAppPlatformRoutes(app, runtime);
  }

  return { app, runtime };
}
