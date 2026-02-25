import { createPublicKey, verify as verifySignature } from "node:crypto";
import type { JsonWebKey as CryptoJsonWebKey } from "node:crypto";
import type { AppEnv } from "@lib/config/env";
import { AppError } from "@lib/errors/app-error";
import { getJwksKeys } from "@lib/auth/jwks-cache";
import type { JwtValidationResult } from "@lib/auth/types";
import { incrementCounter, observeDuration } from "@lib/observability/metrics";

interface JwtHeader {
  alg: string;
  kid: string;
  typ?: string;
}

function decodeJwtPart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

/**
 * Validates Cognito JWT signature and claims.
 * @param token Bearer token
 * @param env Environment config
 * @returns Validation result with claims
 */
export async function validateCognitoJwt(token: string, env: AppEnv): Promise<JwtValidationResult> {
  const startedAt = Date.now();
  const sections = token.split(".");
  if (sections.length !== 3) {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "invalid_format" });
    incrementCounter("auth.token_validation.failed", { reason: "invalid_token_format" });
    return { valid: false, reason: "invalid_token_format" };
  }

  const headerPart = sections[0];
  const payloadPart = sections[1];
  const signaturePart = sections[2];
  if (!headerPart || !payloadPart || !signaturePart) {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "invalid_sections" });
    incrementCounter("auth.token_validation.failed", { reason: "invalid_token_sections" });
    return { valid: false, reason: "invalid_token_sections" };
  }
  const header = decodeJwtPart<JwtHeader>(headerPart);
  const claims = decodeJwtPart<Record<string, unknown>>(payloadPart);

  if (header.alg !== "RS256") {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "unsupported_alg" });
    incrementCounter("auth.token_validation.failed", { reason: "unsupported_alg" });
    return { valid: false, reason: "unsupported_alg" };
  }

  const keys = await getJwksKeys(env);
  const key = keys.find((item) => item.kid === header.kid);
  if (!key) {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "kid_not_found" });
    incrementCounter("auth.token_validation.failed", { reason: "kid_not_found" });
    return { valid: false, reason: "kid_not_found" };
  }

  const issuer = `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`;
  if (claims["iss"] !== issuer) {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "issuer_mismatch" });
    incrementCounter("auth.token_validation.failed", { reason: "issuer_mismatch" });
    return { valid: false, reason: "issuer_mismatch" };
  }

  const aud = claims["aud"];
  const clientId = claims["client_id"];
  if (aud !== env.COGNITO_CLIENT_ID && clientId !== env.COGNITO_CLIENT_ID) {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "audience_mismatch" });
    incrementCounter("auth.token_validation.failed", { reason: "audience_mismatch" });
    return { valid: false, reason: "audience_mismatch" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = claims["exp"];
  const nbf = claims["nbf"];

  if (typeof exp === "number" && exp < nowSec) {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "token_expired" });
    incrementCounter("auth.token_validation.failed", { reason: "token_expired" });
    return { valid: false, reason: "token_expired" };
  }

  if (typeof nbf === "number" && nbf > nowSec + 30) {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "token_not_active" });
    incrementCounter("auth.token_validation.failed", { reason: "token_not_active" });
    return { valid: false, reason: "token_not_active" };
  }

  const verifier = createPublicKey({ key: key as CryptoJsonWebKey, format: "jwk" });
  const validSig = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    verifier,
    Buffer.from(signaturePart, "base64url")
  );

  if (!validSig) {
    observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "signature_invalid" });
    incrementCounter("auth.token_validation.failed", { reason: "signature_invalid" });
    return { valid: false, reason: "signature_invalid" };
  }

  observeDuration("auth.token_validation.latency_ms", Date.now() - startedAt, { status: "ok" });
  incrementCounter("auth.token_validation.success", { source: "cognito" });
  return { valid: true, claims };
}

/**
 * Ensures JWT is valid, otherwise throws typed auth error.
 * @param token Bearer token
 * @param env Environment config
 * @returns Claims object
 */
export async function requireValidJwt(token: string, env: AppEnv): Promise<Record<string, unknown>> {
  const result = await validateCognitoJwt(token, env);
  if (!result.valid || !result.claims) {
    const code = result.reason === "token_expired" ? "AUTH_TOKEN_EXPIRED" : "AUTH_TOKEN_INVALID";
    throw new AppError({
      code,
      message: "Invalid authentication token",
      payload: code === "AUTH_TOKEN_EXPIRED" ? {} : { reason: result.reason ?? "unknown" },
      retryable: false
    });
  }
  return result.claims;
}
