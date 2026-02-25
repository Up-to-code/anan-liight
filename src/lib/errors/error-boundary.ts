import { setTimeout as delay } from "node:timers/promises";
import { AppError, toAppError } from "@lib/errors/app-error";

/**
 * Wraps an async operation with timeout and typed conversion.
 * @param operation Promise factory
 * @param timeoutMs Timeout budget in milliseconds
 * @param operationName Operation label for diagnostics
 * @returns Operation result
 * @throws AppError on timeout or operation failure
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const controller = new AbortController();

  const timeoutPromise = delay(timeoutMs, undefined, { signal: controller.signal }).then(() => {
    throw new AppError({
      code: "TIMEOUT",
      message: `${operationName} timed out`,
      payload: { timeoutMs, operation: operationName },
      retryable: true
    });
  });

  try {
    const result = await Promise.race([operation(), timeoutPromise]);
    controller.abort();
    return result as T;
  } catch (error) {
    controller.abort();
    if (error instanceof AppError) throw error;
    throw toAppError(error);
  }
}
