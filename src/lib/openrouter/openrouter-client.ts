import { AppError } from "@lib/errors/app-error";
import { withErrorBoundary } from "@lib/errors/error-boundary";
import { chatCompletionSchema, type ChatCompletion, type LlmMessage, type ModelAttemptConfig } from "@lib/openrouter/types";

export interface OpenRouterClientConfig {
  apiKey: string;
  baseUrl: string;
}

export class OpenRouterClient {
  public constructor(private readonly config: OpenRouterClientConfig) {}

  /**
   * Calls OpenRouter chat completions and validates the response schema.
   * @param attempt Model attempt config
   * @param messages LLM messages
   * @param signal Abort signal
   * @returns Validated completion
   * @throws AppError on provider errors or malformed responses
   */
  public async chat(
    attempt: ModelAttemptConfig,
    messages: LlmMessage[],
    signal?: AbortSignal
  ): Promise<ChatCompletion> {
    return withErrorBoundary(async () => {
      const requestInit: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: attempt.model,
          max_tokens: attempt.maxTokens,
          temperature: attempt.temperature,
          messages
        }),
        signal: signal ?? null
      };

      const response = await fetch(this.config.baseUrl, {
        ...requestInit
      });

      if (!response.ok) {
        const body = await response.text();
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        throw new AppError({
          code: response.status === 429 ? "RATE_LIMITED" : "EXTERNAL_PROVIDER_ERROR",
          message: `OpenRouter request failed (${response.status})`,
          payload: response.status === 429
            ? (retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {})
            : { provider: "openrouter", detail: body, statusCode: response.status },
          retryable: response.status >= 500 || response.status === 408 || response.status === 429
        });
      }

      const data: unknown = await response.json();
      const parsed = chatCompletionSchema.safeParse(data);
      if (!parsed.success) {
        throw new AppError({
          code: "MALFORMED_RESPONSE",
          message: "OpenRouter response failed schema validation",
          payload: { provider: "openrouter", model: attempt.model },
          retryable: true
        });
      }

      return parsed.data;
    }, attempt.timeoutMs, `openrouter.chat:${attempt.model}`);
  }
}
