import type { AppEnv } from "@lib/config/env";
import { AppError } from "@lib/errors/app-error";

interface JwkKey {
  [key: string]: string | undefined;
  kid: string;
  kty: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
}

interface JwksResponse {
  keys: JwkKey[];
}

interface CacheEntry {
  fetchedAt: number;
  keys: JwkKey[];
}

const cache = new Map<string, CacheEntry>();
const JWKS_FETCH_TIMEOUT_MS = 5000;

/**
 * Fetches and caches Cognito JWKS keys.
 * @param env App environment
 * @returns JWK keys
 */
export async function getJwksKeys(env: AppEnv): Promise<JwkKey[]> {
  const issuer = `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`;
  const now = Date.now();
  const cached = cache.get(issuer);

  if (cached && now - cached.fetchedAt < env.COGNITO_JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }

  let response: Response;
  try {
    response = await fetch(`${issuer}/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network_error";
    throw new AppError({
      code: "AUTH_TOKEN_INVALID",
      message: "Failed to fetch Cognito JWKS",
      payload: { reason: `jwks_fetch_failed:${reason}` },
      retryable: true
    });
  }
  if (!response.ok) {
    throw new AppError({
      code: "AUTH_TOKEN_INVALID",
      message: "Failed to fetch Cognito JWKS",
      payload: { reason: `jwks_status_${response.status}` },
      retryable: true
    });
  }

  const data = (await response.json()) as JwksResponse;
  cache.set(issuer, { fetchedAt: now, keys: data.keys ?? [] });
  return data.keys ?? [];
}
