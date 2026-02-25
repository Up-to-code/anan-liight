import type { ErrorCode, ErrorPayload } from "@shared/errors";

export class AppError<Code extends ErrorCode> extends Error {
  public readonly code: Code;
  public readonly payload: ErrorPayload<Code>;
  public readonly retryable: boolean;

  public constructor(input: {
    code: Code;
    message: string;
    payload: ErrorPayload<Code>;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(input.message, input.cause ? { cause: input.cause } : undefined);
    this.name = "AppError";
    this.code = input.code;
    this.payload = input.payload;
    this.retryable = input.retryable ?? false;
  }
}

/**
 * Converts unknown errors into an AppError without losing context.
 * @param error Unknown thrown value
 * @returns AppError instance
 * @throws Never throws; always returns
 */
export function toAppError(error: unknown): AppError<"INTERNAL_ERROR"> {
  if (error instanceof AppError) {
    return error as AppError<"INTERNAL_ERROR">;
  }
  const detail = error instanceof Error ? error.message : "Unknown error";
  return new AppError({
    code: "INTERNAL_ERROR",
    message: detail,
    payload: { detail },
    retryable: false,
    cause: error
  });
}
