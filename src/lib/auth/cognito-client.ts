import type { AppEnv } from "@lib/config/env";
import { AppError } from "@lib/errors/app-error";
import type { CognitoTokenResponse } from "@lib/auth/types";

interface TokenEndpointResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

const COGNITO_REQUEST_TIMEOUT_MS = 8000;

function buildTokenHeaders(env: AppEnv): HeadersInit {
  if (env.COGNITO_CLIENT_SECRET && env.COGNITO_CLIENT_SECRET.length > 0) {
    const basic = Buffer.from(`${env.COGNITO_CLIENT_ID}:${env.COGNITO_CLIENT_SECRET}`).toString("base64");
    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`
    };
  }

  return { "Content-Type": "application/x-www-form-urlencoded" };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(COGNITO_REQUEST_TIMEOUT_MS) });
}

/**
 * Builds Cognito hosted login URL.
 * @param env Environment
 * @param state OAuth state token
 * @returns Login URL
 */
export function buildHostedLoginUrl(env: AppEnv, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.COGNITO_CLIENT_ID,
    redirect_uri: env.COGNITO_REDIRECT_URI,
    scope: env.COGNITO_SCOPES,
    state
  });

  return `${env.COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchanges OAuth authorization code for Cognito tokens.
 * @param env Environment
 * @param code Authorization code
 * @returns Token response
 */
export async function exchangeCodeForTokens(env: AppEnv, code: string): Promise<CognitoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.COGNITO_REDIRECT_URI,
    client_id: env.COGNITO_CLIENT_ID
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(`${env.COGNITO_DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: buildTokenHeaders(env),
      body
    });
  } catch (error) {
    throw new AppError({
      code: "AUTH_CODE_EXCHANGE_FAILED",
      message: "Cognito code exchange failed",
      payload: { reason: error instanceof Error ? error.message : "network_error" },
      retryable: true
    });
  }

  if (!response.ok) {
    throw new AppError({
      code: "AUTH_CODE_EXCHANGE_FAILED",
      message: "Cognito code exchange failed",
      payload: { reason: await response.text(), statusCode: response.status },
      retryable: response.status >= 500
    });
  }

  const data = (await response.json()) as TokenEndpointResponse;
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    ...(data.id_token ? { idToken: data.id_token } : {}),
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    ...(data.scope ? { scope: data.scope } : {})
  };
}

/**
 * Refreshes Cognito tokens using refresh token grant.
 * @param env Environment
 * @param refreshToken Refresh token
 * @returns Token response
 */
export async function refreshTokens(env: AppEnv, refreshToken: string): Promise<CognitoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.COGNITO_CLIENT_ID
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(`${env.COGNITO_DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: buildTokenHeaders(env),
      body
    });
  } catch (error) {
    throw new AppError({
      code: "AUTH_CODE_EXCHANGE_FAILED",
      message: "Cognito token refresh failed",
      payload: { reason: error instanceof Error ? error.message : "network_error" },
      retryable: true
    });
  }

  if (!response.ok) {
    throw new AppError({
      code: "AUTH_CODE_EXCHANGE_FAILED",
      message: "Cognito token refresh failed",
      payload: { reason: await response.text(), statusCode: response.status },
      retryable: response.status >= 500
    });
  }

  const data = (await response.json()) as TokenEndpointResponse;
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    ...(data.id_token ? { idToken: data.id_token } : {}),
    refreshToken,
    ...(data.scope ? { scope: data.scope } : {})
  };
}

/**
 * Revokes Cognito refresh token.
 * @param env Environment
 * @param refreshToken Refresh token
 */
export async function revokeToken(env: AppEnv, refreshToken: string): Promise<void> {
  const body = new URLSearchParams({
    token: refreshToken,
    client_id: env.COGNITO_CLIENT_ID
  });

  try {
    await fetchWithTimeout(`${env.COGNITO_DOMAIN}/oauth2/revoke`, {
      method: "POST",
      headers: buildTokenHeaders(env),
      body
    });
  } catch (error) {
    throw new AppError({
      code: "AUTH_SESSION_INVALID",
      message: "Failed to revoke refresh token",
      payload: { reason: error instanceof Error ? error.message : "network_error" },
      retryable: true
    });
  }
}
