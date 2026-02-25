export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_CODE_EXCHANGE_FAILED: "AUTH_CODE_EXCHANGE_FAILED",
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  TIMEOUT: "TIMEOUT",
  QUEUE_FULL: "QUEUE_FULL",
  EXTERNAL_PROVIDER_ERROR: "EXTERNAL_PROVIDER_ERROR",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  MALFORMED_RESPONSE: "MALFORMED_RESPONSE",
  CIRCUIT_OPEN: "CIRCUIT_OPEN",
  IDEMPOTENCY_REPLAY: "IDEMPOTENCY_REPLAY",
  INTERNAL_ERROR: "INTERNAL_ERROR"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ErrorPayloadMap = {
  VALIDATION_ERROR: { field?: string; reason: string };
  AUTH_REQUIRED: { reason: string };
  FORBIDDEN: { reason: string };
  NOT_FOUND: { entity: string; id?: string };
  CONFLICT: { reason: string };
  RATE_LIMITED: { retryAfterSeconds?: number };
  AUTH_TOKEN_INVALID: { reason: string };
  AUTH_TOKEN_EXPIRED: { expiredAt?: number };
  AUTH_CODE_EXCHANGE_FAILED: { reason: string; statusCode?: number };
  AUTH_SESSION_INVALID: { reason: string };
  TIMEOUT: { timeoutMs: number; operation: string };
  QUEUE_FULL: { queueName: string; capacity: number };
  EXTERNAL_PROVIDER_ERROR: { provider: string; detail: string; statusCode?: number };
  MODEL_UNAVAILABLE: { model: string; detail: string };
  MALFORMED_RESPONSE: { provider: string; model: string };
  CIRCUIT_OPEN: { circuit: string; retryAt: number };
  IDEMPOTENCY_REPLAY: { key: string; scope: string };
  INTERNAL_ERROR: { detail: string; operation?: string };
};

export type ErrorPayload<Code extends ErrorCode> = ErrorPayloadMap[Code];
