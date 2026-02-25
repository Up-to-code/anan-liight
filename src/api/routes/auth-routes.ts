import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authCallbackQuerySchema, refreshRequestSchema } from "@api/schema/auth";
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  getOAuthStateCookie,
  getSessionIdFromRequest,
  requireAuth,
  setOAuthStateCookie,
  setSessionCookie
} from "@api/middleware/auth";
import { buildHostedLoginUrl, exchangeCodeForTokens, refreshTokens, revokeToken } from "@lib/auth/cognito-client";
import { createSignedState, verifySignedState } from "@lib/auth/oauth-state";
import { requireValidJwt } from "@lib/auth/token-validator";
import { incrementCounter } from "@lib/observability/metrics";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { ROUTE_PATHS } from "@shared/constants";

function isCognitoEnabled(runtime: RuntimeContainer): boolean {
  return runtime.env.COGNITO_ENABLED && runtime.env.FEATURE_AUTH_COGNITO_ENABLED;
}

function isSecureCookies(runtime: RuntimeContainer): boolean {
  return runtime.env.NODE_ENV === "production";
}

export async function registerAuthRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.get(ROUTE_PATHS.AUTH_LOGIN, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isCognitoEnabled(runtime)) {
      reply.code(404).send({ error: "Not available" });
      return;
    }

    if (!runtime.env.SESSION_ENCRYPTION_KEY) {
      reply.code(503).send({ error: "Auth not configured" });
      return;
    }

    const query = request.query as { redirectTo?: string };
    const statePayload = {
      nonce: randomUUID(),
      createdAt: Date.now(),
      ...(query.redirectTo ? { redirectTo: query.redirectTo } : {})
    };
    const state = createSignedState(statePayload, runtime.env.SESSION_ENCRYPTION_KEY);

    setOAuthStateCookie(reply, state, isSecureCookies(runtime));
    incrementCounter("auth.login.started", { mode: "hosted" });
    reply.redirect(buildHostedLoginUrl(runtime.env, state));
  });

  app.get(ROUTE_PATHS.AUTH_CALLBACK, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isCognitoEnabled(runtime)) {
      reply.code(404).send({ error: "Not available" });
      return;
    }

    const parsed = authCallbackQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Missing code/state" });
      return;
    }

    const cookieState = getOAuthStateCookie(request);
    if (!cookieState || cookieState !== parsed.data.state) {
      incrementCounter("auth.callback.failed", { reason: "state_cookie_mismatch" });
      reply.code(400).send({ error: "Invalid state" });
      return;
    }

    try {
      const statePayload = verifySignedState(parsed.data.state, runtime.env.SESSION_ENCRYPTION_KEY, 10 * 60 * 1000);
      const tokens = await exchangeCodeForTokens(runtime.env, parsed.data.code);
      const jwt = tokens.idToken ?? tokens.accessToken;
      const claims = await requireValidJwt(jwt, runtime.env);
      const userId = (claims["sub"] as string | undefined) ?? "unknown-user";

      const sessionId = await runtime.sessionStore.createSession(userId, tokens);
      setSessionCookie(reply, sessionId, isSecureCookies(runtime));
      clearOAuthStateCookie(reply);
      incrementCounter("auth.callback.success", { mode: "hosted" });

      if (statePayload.redirectTo?.startsWith("/")) {
        reply.redirect(statePayload.redirectTo);
        return;
      }

      reply.code(200).send({ status: "authenticated", userId });
    } catch (error) {
      incrementCounter("auth.callback.failed", { reason: "exchange_or_validation" });
      const message = error instanceof Error ? error.message : "Authentication failed";
      reply.code(401).send({ error: message });
    }
  });

  app.post(ROUTE_PATHS.AUTH_REFRESH, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isCognitoEnabled(runtime)) {
      reply.code(404).send({ error: "Not available" });
      return;
    }

    const parsed = refreshRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload" });
      return;
    }

    const fallbackSessionId = getSessionIdFromRequest(request);
    const sessionId = parsed.data.sessionId ?? fallbackSessionId;
    if (!sessionId) {
      reply.code(401).send({ error: "Missing session" });
      return;
    }

    const session = await runtime.sessionStore.getSession(sessionId);
    if (!session) {
      incrementCounter("auth.refresh.failed", { reason: "session_not_found" });
      reply.code(401).send({ error: "Invalid session" });
      return;
    }

    const payload = JSON.parse(session.tokenPayloadJson) as { refreshToken?: string };
    if (!payload.refreshToken) {
      incrementCounter("auth.refresh.failed", { reason: "missing_refresh_token" });
      reply.code(401).send({ error: "Session cannot be refreshed" });
      return;
    }

    const refreshed = await refreshTokens(runtime.env, payload.refreshToken);
    await runtime.sessionStore.updateSession(sessionId, refreshed);
    incrementCounter("auth.refresh.success", { mode: "session" });

    reply.code(200).send({ status: "refreshed" });
  });

  app.post(ROUTE_PATHS.AUTH_LOGOUT, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isCognitoEnabled(runtime)) {
      reply.code(404).send({ error: "Not available" });
      return;
    }

    const sessionId = getSessionIdFromRequest(request);
    if (sessionId) {
      const session = await runtime.sessionStore.getSession(sessionId);
      if (session) {
        const payload = JSON.parse(session.tokenPayloadJson) as { refreshToken?: string };
        if (payload.refreshToken) {
          await revokeToken(runtime.env, payload.refreshToken);
        }
        await runtime.sessionStore.revokeSession(sessionId);
      }
    }

    clearSessionCookie(reply);
    incrementCounter("auth.logout.success", { mode: "session" });
    reply.code(200).send({ status: "logged_out" });
  });

  app.get(ROUTE_PATHS.AUTH_ME, { preHandler: requireAuth(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authContext) {
      reply.code(401).send({ error: "Authentication required" });
      return;
    }

    reply.code(200).send({
      userId: request.authContext.userId,
      tenantId: request.authContext.tenantId,
      roles: request.authContext.roles,
      authSource: request.authContext.authSource
    });
  });
}
