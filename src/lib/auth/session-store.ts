import { randomUUID } from "node:crypto";
import type { SpacetimeStore } from "@modules/internal/spacetime-store";
import { TABLE_NAMES } from "@shared/constants";
import type { CognitoTokenResponse } from "@lib/auth/types";
import { decryptSessionPayload, encryptSessionPayload } from "@lib/auth/session-crypto";

interface SessionRow {
  id: string;
  sessionId: string;
  userId: string;
  tokenPayloadJson: string;
  expiresAt: number;
  revoked: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Persists and reads auth sessions in SpacetimeDB.
 */
export class SessionStore {
  public constructor(
    private readonly store: SpacetimeStore,
    private readonly sessionEncryptionKey: string
  ) {}

  /**
   * Creates new session.
   * @param userId User id
   * @param tokenResponse Cognito tokens
   * @returns Session id
   */
  public async createSession(userId: string, tokenResponse: CognitoTokenResponse): Promise<string> {
    const now = Date.now();
    const sessionId = randomUUID();
    const expiresAt = now + tokenResponse.expiresIn * 1000;

    await this.store.insert(TABLE_NAMES.SESSION_TOKENS, {
      id: randomUUID(),
      sessionId,
      userId,
      tokenPayloadJson: encryptSessionPayload(tokenResponse, this.sessionEncryptionKey),
      expiresAt,
      revoked: false,
      version: 1,
      createdAt: now,
      updatedAt: now
    } satisfies SessionRow);

    return sessionId;
  }

  /**
   * Reads non-revoked, non-expired session.
   * @param sessionId Session id
   * @returns Session row or null
   */
  public async getSession(sessionId: string): Promise<SessionRow | null> {
    const row = await this.store.queryOne<SessionRow>(TABLE_NAMES.SESSION_TOKENS, [
      { field: "sessionId", op: "eq", value: sessionId }
    ]);

    if (!row || row.revoked || row.expiresAt <= Date.now()) return null;
    const decrypted = decryptSessionPayload(row.tokenPayloadJson, this.sessionEncryptionKey);
    return { ...row, tokenPayloadJson: JSON.stringify(decrypted) };
  }

  /**
   * Replaces token payload and extends expiry.
   * @param sessionId Session id
   * @param tokenResponse New tokens
   */
  public async updateSession(sessionId: string, tokenResponse: CognitoTokenResponse): Promise<void> {
    const row = await this.store.queryOne<SessionRow>(TABLE_NAMES.SESSION_TOKENS, [
      { field: "sessionId", op: "eq", value: sessionId }
    ]);

    if (!row) return;

    const now = Date.now();
    await this.store.updateVersioned<SessionRow>(TABLE_NAMES.SESSION_TOKENS, row.id, row.version, {
      tokenPayloadJson: encryptSessionPayload(tokenResponse, this.sessionEncryptionKey),
      expiresAt: now + tokenResponse.expiresIn * 1000,
      version: row.version + 1,
      updatedAt: now
    });
  }

  /**
   * Revokes session.
   * @param sessionId Session id
   */
  public async revokeSession(sessionId: string): Promise<void> {
    const row = await this.store.queryOne<SessionRow>(TABLE_NAMES.SESSION_TOKENS, [
      { field: "sessionId", op: "eq", value: sessionId }
    ]);

    if (!row) return;

    await this.store.updateVersioned<SessionRow>(TABLE_NAMES.SESSION_TOKENS, row.id, row.version, {
      revoked: true,
      version: row.version + 1,
      updatedAt: Date.now()
    });
  }
}
