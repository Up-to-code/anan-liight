import { describe, expect, test } from "vitest";
import { withErrorBoundary } from "@lib/errors/error-boundary";

describe("withErrorBoundary", () => {
  test("resolves with result on success", async () => {
    const result = await withErrorBoundary(
      async () => "ok",
      5000,
      "test"
    );
    expect(result).toBe("ok");
  });

  test("throws TIMEOUT on slow operation", async () => {
    await expect(
      withErrorBoundary(
        () => new Promise((r) => setTimeout(() => r(1), 100)),
        10,
        "slow"
      )
    ).rejects.toMatchObject({
      code: "TIMEOUT",
      message: "slow timed out"
    });
  });

  test("converts unknown errors via toAppError", async () => {
    await expect(
      withErrorBoundary(
        async () => {
          throw new Error("raw error");
        },
        5000,
        "fail"
      )
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR"
    });
  });

  test("passes through AppError", async () => {
    const { AppError } = await import("@lib/errors/app-error");
    await expect(
      withErrorBoundary(
        async () => {
          throw new AppError({
            code: "VALIDATION_ERROR",
            message: "bad",
            payload: { reason: "bad" },
            retryable: false
          });
        },
        5000,
        "fail"
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
  });
});
