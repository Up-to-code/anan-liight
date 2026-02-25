import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@lib/errors/app-error";
import { requireValidJwt } from "@lib/auth/token-validator";
import type { AuthenticatedRequestContext } from "@lib/auth/types";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { incrementCounter, observeDuration } from "@lib/observability/metrics";

const SESSION_COOKIE = "anan_session";

function appendSetCookie(reply: FastifyReply, value: string): void {
  const existing = reply.getHeader("Set-Cookie");
  if (Array.isArray(existing)) {
    reply.header("Set-Cookie", [...existing, value]);
    return;
  }
  if (typeof existing === "string") {
    reply.header("Set-Cookie", [existing, value]);
    return;
  }
  reply.header("Set-Cookie", value);
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

function parseBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

function getStringClaim(claims: Record<string, unknown>, key: string): string | undefined {
  const value = claims[key];
  return typeof value === "string" ? value : undefined;
}

function buildContextFromClaims(claims: Record<string, unknown>, source: "cognito_jwt" | "session"): AuthenticatedRequestContext {
  const groups = Array.isArray(claims["cognito:groups"])
    ? (claims["cognito:groups"] as unknown[]).filter((item): item is string => typeof item === "string")
    : [];

  const roles = groups.length > 0 ? groups : ["user"];
  if (!roles.includes("user")) roles.unshift("user");

  return {
    userId: getStringClaim(claims, "sub") ?? getStringClaim(claims, "username") ?? "unknown-user",
    tenantId: getStringClaim(claims, "custom:tenant_id") ?? "default",
    roles,
    authSource: source,
    claims
  };
}

async function resolveSessionContext(runtime: RuntimeContainer, request: FastifyRequest): Promise<AuthenticatedRequestContext | null> {
  const cookies = parseCookies(request.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return null;
  try {
    const session = await runtime.sessionStore.getSession(sessionId);
    if (!session) return null;

    const tokenPayload = JSON.parse(session.tokenPayloadJson) as {
      accessToken?: string;
      idToken?: string;
    };

    const jwt = tokenPayload.idToken ?? tokenPayload.accessToken;
    if (!jwt) return null;

    const claims = await requireValidJwt(jwt, runtime.env);
    const context = buildContextFromClaims(claims, "session");
    context.sessionId = sessionId;
    return context;
  } catch {
    incrementCounter("auth.resolve.failed", { source: "session" });
    return null;
  }
}

async function resolveBearerContext(runtime: RuntimeContainer, request: FastifyRequest): Promise<AuthenticatedRequestContext | null> {
  const bearer = parseBearerToken(request.headers.authorization);
  const roleHeader = request.headers["x-admin-role"];

  if (!runtime.env.FEATURE_AUTH_COGNITO_ENABLED || !runtime.env.COGNITO_ENABLED) {
    if (!bearer && roleHeader !== "admin") return null;
    const role = roleHeader === "admin" ? "admin" : "user";
    return {
      userId: (request.headers["x-user-id"]?.toString() ?? "legacy-user"),
      tenantId: "default",
      roles: [role],
      authSource: "legacy",
      claims: { legacyBearer: true }
    };
  }
  if (!bearer) return null;

  const claims = await requireValidJwt(bearer, runtime.env);
  return buildContextFromClaims(claims, "cognito_jwt");
}

/**
 * Resolves request auth context from session or bearer.
 * @param runtime Runtime container
 * @param request Fastify request
 * @returns Auth context or null
 */
export async function resolveAuthContext(
  runtime: RuntimeContainer,
  request: FastifyRequest
): Promise<AuthenticatedRequestContext | null> {
  const startedAt = Date.now();
  const fromSession = await resolveSessionContext(runtime, request);
  if (fromSession) {
    observeDuration("auth.resolve.latency_ms", Date.now() - startedAt, { source: "session", status: "ok" });
    incrementCounter("auth.resolve.success", { source: "session" });
    return fromSession;
  }

  const fromBearer = await resolveBearerContext(runtime, request);
  observeDuration("auth.resolve.latency_ms", Date.now() - startedAt, {
    source: "bearer",
    status: fromBearer ? "ok" : "miss"
  });
  if (fromBearer) {
    incrementCounter("auth.resolve.success", { source: "bearer" });
  }
  return fromBearer;
}

/**
 * Optional auth middleware used for canary endpoints.
 * @param runtime Runtime container
 * @returns Fastify preHandler
 */
export function optionalAuth(runtime: RuntimeContainer) {
  return async (request: FastifyRequest): Promise<void> => {
    try {
      const context = await resolveAuthContext(runtime, request);
      if (context) {
        request.authContext = context;
      }
    } catch {
      incrementCounter("auth.resolve.failed", { source: "optional_auth" });
    }
  };
}

/**
 * Required auth middleware.
 * @param runtime Runtime container
 * @returns Fastify preHandler
 */
export function requireAuth(runtime: RuntimeContainer) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const context = await resolveAuthContext(runtime, request);
    if (!context) {
      const error = new AppError({
        code: "AUTH_REQUIRED",
        message: "Authentication required",
        payload: { reason: "missing_token" },
        retryable: false
      });
      reply.code(401).send({ error: error.message, code: error.code });
      return;
    }

    request.authContext = context;
  };
}

/**
 * Required role middleware.
 * @param runtime Runtime container
 * @param requiredRole Role to enforce
 * @returns Fastify preHandler
 */
export function requireRole(runtime: RuntimeContainer, requiredRole: "admin" | "user") {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHandler = requireAuth(runtime);
    await authHandler(request, reply);
    if (reply.sent) return;

    const roles = request.authContext?.roles ?? [];
    if (!roles.includes(requiredRole)) {
      reply.code(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
  };
}

/**
 * Ensures tenant context exists on authenticated request.
 * @param runtime Runtime container
 * @returns Fastify preHandler
 */
export function requireTenantContext(runtime: RuntimeContainer) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHandler = requireAuth(runtime);
    await authHandler(request, reply);
    if (reply.sent) return;

    if (!request.authContext?.tenantId) {
      reply.code(403).send({ error: "Missing tenant context" });
    }
  };
}

/**
 * Backward-compatible admin guard.
 * @param runtime Runtime container
 * @returns Fastify preHandler
 */
export function requireAdmin(runtime: RuntimeContainer) {
  return requireRole(runtime, "admin");
}

/**
 * Parses session id from cookies.
 * @param request Fastify request
 * @returns Session id or null
 */
export function getSessionIdFromRequest(request: FastifyRequest): string | null {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[SESSION_COOKIE] ?? null;
}

/**
 * Sets session cookie on response.
 * @param reply Fastify reply
 * @param sessionId Session id
 * @param secure Use secure cookie flag
 */
export function setSessionCookie(reply: FastifyReply, sessionId: string, secure: boolean): void {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : ""
  ].filter(Boolean);

  appendSetCookie(reply, attributes.join("; "));
}

/**
 * Clears session cookie on response.
 * @param reply Fastify reply
 */
export function clearSessionCookie(reply: FastifyReply): void {
  appendSetCookie(reply, `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/**
 * Sets temporary OAuth state cookie.
 * @param reply Fastify reply
 * @param state Signed state
 * @param secure Secure flag
 */
export function setOAuthStateCookie(reply: FastifyReply, state: string, secure: boolean): void {
  const attributes = [
    `anan_oauth_state=${encodeURIComponent(state)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    secure ? "Secure" : ""
  ].filter(Boolean);

  appendSetCookie(reply, attributes.join("; "));
}

/**
 * Reads OAuth state cookie.
 * @param request Fastify request
 * @returns Signed state or null
 */
export function getOAuthStateCookie(request: FastifyRequest): string | null {
  const cookies = parseCookies(request.headers.cookie);
  return cookies["anan_oauth_state"] ?? null;
}

/**
 * Clears OAuth state cookie after callback.
 * @param reply Fastify reply
 */
export function clearOAuthStateCookie(reply: FastifyReply): void {
  appendSetCookie(reply, "anan_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}
