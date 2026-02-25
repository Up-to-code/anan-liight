import { describe, expect, test } from "vitest";
import { getLiveness } from "../../src/modules/queries/health-query";

describe("health-query", () => {
  describe("getLiveness", () => {
    test("returns ok status", () => {
      const result = getLiveness();
      expect(result).toEqual({ status: "ok" });
    });
  });
});
