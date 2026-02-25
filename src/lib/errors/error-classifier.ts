import { AppError } from "@lib/errors/app-error";
import type { ErrorCode } from "@shared/errors";

export type ErrorClass = "recoverable" | "fatal";

/**
 * Classifies AppError instances for retry and DLQ routing.
 * @param error Error instance
 * @returns recoverable or fatal
 * @throws Never throws
 */
export function classifyError(error: AppError<ErrorCode>): ErrorClass {
  if (error.retryable) return "recoverable";

  switch (error.code) {
    case "RATE_LIMITED":
    case "TIMEOUT":
    case "MODEL_UNAVAILABLE":
    case "MALFORMED_RESPONSE":
    case "EXTERNAL_PROVIDER_ERROR":
      return "recoverable";
    default:
      return "fatal";
  }
}
