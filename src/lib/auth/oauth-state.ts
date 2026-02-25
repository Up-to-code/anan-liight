import { createHmac, timingSafeEqual } from "node:crypto";
import type { OAuthStatePayload } from "@lib/auth/types";
import { AppError } from "@lib/errors/app-error";

function toBase64Url(input: Buffer): string {
  return input.toString("base64url");
}

function fromBase64Url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

/**
 * Creates signed OAuth state token.
 * @param payload State payload
 * @param secret HMAC secret
 * @returns Signed state token
 */
export function createSignedState(payload: OAuthStatePayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = createHmac("sha256", secret).update(data).digest();
  return `${toBase64Url(data)}.${toBase64Url(signature)}`;
}

/**
 * Verifies signed OAuth state token and TTL.
 * @param token Signed state token
 * @param secret HMAC secret
 * @param ttlMs Max age in ms
 * @returns Decoded payload
 * @throws AppError when token invalid/expired
 */
export function verifySignedState(token: string, secret: string, ttlMs: number): OAuthStatePayload {
  const [dataPart, signaturePart] = token.split(".");
  if (!dataPart || !signaturePart) {
    throw new AppError({
      code: "AUTH_SESSION_INVALID",
      message: "Invalid OAuth state format",
      payload: { reason: "missing_parts" },
      retryable: false
    });
  }

  const data = fromBase64Url(dataPart);
  const expected = createHmac("sha256", secret).update(data).digest();
  const provided = fromBase64Url(signaturePart);

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new AppError({
      code: "AUTH_SESSION_INVALID",
      message: "Invalid OAuth state signature",
      payload: { reason: "signature_mismatch" },
      retryable: false
    });
  }

  const payload = JSON.parse(data.toString("utf8")) as OAuthStatePayload;
  if (Date.now() - payload.createdAt > ttlMs) {
    throw new AppError({
      code: "AUTH_SESSION_INVALID",
      message: "OAuth state expired",
      payload: { reason: "expired" },
      retryable: false
    });
  }

  return payload;
}
