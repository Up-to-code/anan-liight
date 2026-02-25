import { describe, expect, test } from "vitest";
import { executeWithRetry } from "../../src/lib/retry/retry-executor";
import { AppError } from "../../src/lib/errors/app-error";

describe("executeWithRetry", () => {
  test("retries recoverable failures and succeeds", async () => {
    let calls = 0;

    const result = await executeWithRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new AppError({
            code: "TIMEOUT",
            message: "transient",
            payload: { timeoutMs: 100, operation: "test" },
            retryable: true
          });
        }
        return "ok";
      },
      { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 10, deadlineMs: 1000, jitter: "none" },
      { scope: "test", operation: "retry", idempotencyKey: "k1" }
    );

    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });
});
