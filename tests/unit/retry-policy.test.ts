import { describe, expect, test } from "vitest";
import { computeRetryDelay } from "@lib/retry/retry-policy";

describe("retry-policy", () => {
  test("computeRetryDelay with jitter none returns exponential backoff", () => {
    const policy = {
      maxAttempts: 5,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      deadlineMs: 30000,
      jitter: "none" as const
    };
    const attempt1 = computeRetryDelay(1, policy);
    const attempt2 = computeRetryDelay(2, policy);
    const attempt3 = computeRetryDelay(3, policy);
    expect(attempt1).toBe(100);
    expect(attempt2).toBe(200);
    expect(attempt3).toBe(400);
  });

  test("computeRetryDelay with jitter none caps at maxDelayMs", () => {
    const policy = {
      maxAttempts: 10,
      baseDelayMs: 1000,
      maxDelayMs: 2000,
      deadlineMs: 60000,
      jitter: "none" as const
    };
    const result = computeRetryDelay(5, policy);
    expect(result).toBe(2000);
  });

  test("computeRetryDelay with jitter full returns value in expected range", () => {
    const policy = {
      maxAttempts: 5,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      deadlineMs: 30000,
      jitter: "full" as const
    };
    for (let i = 0; i < 20; i++) {
      const result = computeRetryDelay(1, policy);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(101);
    }
  });
});
