import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "@lib/errors/app-error";
import type { CognitoTokenResponse } from "@lib/auth/types";

const CIPHER_ALGORITHM = "aes-256-gcm";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function assertSecret(secret: string): void {
  if (secret.trim().length < 16) {
    throw new AppError({
      code: "AUTH_SESSION_INVALID",
      message: "Session encryption key is not configured",
      payload: { reason: "missing_session_encryption_key" },
      retryable: false
    });
  }
}

/**
 * Encrypts Cognito token payload before storing in database.
 * @param payload Token payload
 * @param secret Encryption secret
 * @returns Encrypted payload string
 */
export function encryptSessionPayload(payload: CognitoTokenResponse, secret: string): string {
  assertSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGORITHM, deriveKey(secret), iv);
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/**
 * Decrypts token payload from session store.
 * @param encrypted Encrypted payload
 * @param secret Encryption secret
 * @returns Decrypted token payload
 */
export function decryptSessionPayload(encrypted: string, secret: string): CognitoTokenResponse {
  assertSecret(secret);
  const [ivPart, tagPart, dataPart] = encrypted.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new AppError({
      code: "AUTH_SESSION_INVALID",
      message: "Invalid session payload format",
      payload: { reason: "invalid_session_payload" },
      retryable: false
    });
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const data = Buffer.from(dataPart, "base64url");
  const decipher = createDecipheriv(CIPHER_ALGORITHM, deriveKey(secret), iv);
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(plaintext) as CognitoTokenResponse;
  } catch {
    throw new AppError({
      code: "AUTH_SESSION_INVALID",
      message: "Session payload decryption failed",
      payload: { reason: "session_decryption_failed" },
      retryable: false
    });
  }
}
