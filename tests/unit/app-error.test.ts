import { describe, expect, test } from "vitest";
import { AppError } from "../../src/lib/errors/app-error";

describe("AppError", () => {
  test("keeps code and payload", () => {
    const error = new AppError({
      code: "VALIDATION_ERROR",
      message: "invalid",
      payload: { reason: "bad input" },
      retryable: false
    });

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.payload.reason).toBe("bad input");
    expect(error.retryable).toBe(false);
  });
});
