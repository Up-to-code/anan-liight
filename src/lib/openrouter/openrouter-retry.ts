import { AppError } from "@lib/errors/app-error";
import { executeWithRetry } from "@lib/retry/retry-executor";
import type { RetryPolicy } from "@lib/retry/retry-policy";
import { ModelFallbackChain } from "@lib/openrouter/model-fallback-chain";
import { OpenRouterClient } from "@lib/openrouter/openrouter-client";
import type { ChatCompletion, LlmMessage, ModelAttemptConfig } from "@lib/openrouter/types";
import type { ErrorCode } from "@shared/errors";

export interface OpenRouterRetryOptions {
  chain: ModelFallbackChain;
  retryPolicy: RetryPolicy;
}

/**
 * Executes a chat completion using fallback chain and retry policy.
 * @param client OpenRouter client
 * @param messages Chat messages
 * @param options Retry and fallback options
 * @returns Model response with selected model
 * @throws AppError when no attempts succeed
 */
export async function executeOpenRouterWithFallback(
  client: OpenRouterClient,
  messages: LlmMessage[],
  options: OpenRouterRetryOptions
): Promise<{ model: string; response: ChatCompletion }> {
  const attempts = await options.chain.getAvailableAttempts();
  let lastError: AppError<ErrorCode> | null = null;

  for (const attempt of attempts) {
    try {
      const response = await executeWithRetry(
        () => client.chat(attempt, messages),
        options.retryPolicy,
        {
          scope: "openrouter",
          operation: `chat:${attempt.model}`,
          idempotencyKey: crypto.randomUUID()
        }
      );
      await options.chain.recordSuccess(attempt.model);
      return { model: attempt.model, response };
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError({
              code: "EXTERNAL_PROVIDER_ERROR",
              message: "OpenRouter attempt failed",
              payload: { provider: "openrouter", detail: "Unknown model failure" },
              retryable: true,
              cause: error
            });
      await options.chain.recordFailure(attempt.model);
      lastError = appError;
    }
  }

  throw (
    lastError ??
    new AppError({
      code: "MODEL_UNAVAILABLE",
      message: "All fallback models failed",
      payload: { model: "fallback-chain", detail: "No model returned successfully" },
      retryable: true
    })
  );
}

export function createDefaultModelAttempts(input: {
  models: string[];
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}): ModelAttemptConfig[] {
  return input.models.map((model) => ({
    model,
    timeoutMs: input.timeoutMs,
    maxTokens: input.maxTokens,
    temperature: input.temperature
  }));
}
