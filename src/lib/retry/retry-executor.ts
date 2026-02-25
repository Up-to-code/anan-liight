import { setTimeout as delay } from "node:timers/promises";
import { AppError } from "@lib/errors/app-error";
import { classifyError } from "@lib/errors/error-classifier";
import type { DeadLetterWriter } from "@lib/retry/dead-letter";
import { computeRetryDelay, type RetryPolicy } from "@lib/retry/retry-policy";
import type { ErrorCode } from "@shared/errors";

export interface RetryContext {
  scope: string;
  operation: string;
  idempotencyKey: string;
}

/**
 * Executes async operations with typed retry and optional dead-letter fallback.
 * @param execute Async operation to run
 * @param policy Retry policy
 * @param context Operation metadata
 * @param deadLetter Optional writer for terminal failures
 * @returns Operation result
 * @throws AppError if all attempts fail
 */
export async function executeWithRetry<T>(
  execute: () => Promise<T>,
  policy: RetryPolicy,
  context: RetryContext,
  deadLetter?: DeadLetterWriter
): Promise<T> {
  const startedAt = Date.now();
  let lastError: AppError<ErrorCode> | null = null;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await execute();
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError({
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "Unknown error",
              payload: { detail: error instanceof Error ? error.message : "Unknown error" },
              retryable: false,
              cause: error
            });

      lastError = appError;
      if (classifyError(appError) === "fatal") break;
      if (attempt === policy.maxAttempts) break;
      if (Date.now() - startedAt >= policy.deadlineMs) break;

      const waitMs = computeRetryDelay(attempt, policy);
      await delay(waitMs);
    }
  }

  if (lastError && deadLetter) {
    await deadLetter.write({
      deadLetterId: crypto.randomUUID(),
      scope: context.scope,
      operation: context.operation,
      idempotencyKey: context.idempotencyKey,
      errorCode: lastError.code,
      errorMessage: lastError.message,
      payload: { retryable: String(lastError.retryable) },
      createdAt: Date.now()
    });
  }

  if (lastError) throw lastError;

  throw new AppError({
    code: "INTERNAL_ERROR",
    message: "Retry executor exited without result",
    payload: { detail: "No result and no error captured", operation: context.operation },
    retryable: false
  });
}
