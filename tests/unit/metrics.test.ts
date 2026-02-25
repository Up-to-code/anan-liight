import { describe, expect, test } from "vitest";
import { incrementCounter, observeDuration, readDurations } from "@lib/observability/metrics";

describe("metrics", () => {
  test("incrementCounter does not throw", () => {
    incrementCounter("unit_test_counter", { scope: "test" });
    incrementCounter("unit_test_counter", { scope: "test" });
  });

  test("observeDuration and readDurations", () => {
    const before = readDurations().length;
    observeDuration("test_duration", 100, { op: "test" });
    const after = readDurations();
    expect(after.length).toBeGreaterThanOrEqual(before + 1);
    const last = after[after.length - 1];
    expect(last).toBeDefined();
    expect(last!.name).toBe("test_duration");
    expect(last!.ms).toBe(100);
    expect(last!.tags).toEqual({ op: "test" });
  });
});
