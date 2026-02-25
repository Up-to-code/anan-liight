import type { AppEnv } from "@lib/config/env";

export interface AuthenticatedRequestContext {
  userId: string;
  tenantId: string;
  roles: string[];
  authSource: "cognito_jwt" | "session" | "legacy";
  sessionId?: string;
  claims: Record<string, unknown>;
}

export interface CognitoTokenResponse {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}

export interface OAuthStatePayload {
  nonce: string;
  redirectTo?: string;
  createdAt: number;
}

export interface JwtValidationResult {
  valid: boolean;
  claims?: Record<string, unknown>;
  reason?: string;
}

export interface AuthRuntime {
  env: AppEnv;
}
