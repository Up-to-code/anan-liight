import { describe, expect, test } from "vitest";
import { AppError } from "../../src/lib/errors/app-error";
import { classifyError } from "../../src/lib/errors/error-classifier";

describe("error-classifier", () => {
  test("returns recoverable for retryable errors", () => {
    const error = new AppError({
      code: "VALIDATION_ERROR",
      message: "err",
      payload: { reason: "test" },
      retryable: true
    });
    expect(classifyError(error)).toBe("recoverable");
  });

  test("returns recoverable for RATE_LIMITED", () => {
    const error = new AppError({
      code: "RATE_LIMITED",
      message: "err",
      payload: { retryAfterSeconds: 60 },
      retryable: false
    });
    expect(classifyError(error)).toBe("recoverable");
  });

  test("returns recoverable for TIMEOUT", () => {
    const error = new AppError({
      code: "TIMEOUT",
      message: "err",
      payload: { timeoutMs: 5000, operation: "test" },
      retryable: false
    });
    expect(classifyError(error)).toBe("recoverable");
  });

  test("returns fatal for non-recoverable codes", () => {
    const error = new AppError({
      code: "VALIDATION_ERROR",
      message: "err",
      payload: { reason: "invalid" },
      retryable: false
    });
    expect(classifyError(error)).toBe("fatal");
  });
});
