import { describe, expect, test } from "vitest";
import { AdaptiveThrottle } from "@lib/whatsapp/rate-control";

describe("AdaptiveThrottle", () => {
  test("snapshot returns delayMs", () => {
    const throttle = new AdaptiveThrottle(50, 2000);
    expect(throttle.snapshot()).toEqual({ delayMs: 50 });
  });

  test("onSuccess decreases delay when latency < 400 and above min", () => {
    const throttle = new AdaptiveThrottle(100, 2000);
    throttle.onBackpressure();
    const before = throttle.snapshot().delayMs;
    throttle.onSuccess(200);
    expect(throttle.snapshot().delayMs).toBeLessThan(before);
  });

  test("onSuccess does not decrease below minDelayMs", () => {
    const throttle = new AdaptiveThrottle(100, 2000);
    throttle.onBackpressure();
    throttle.onSuccess(200);
    throttle.onSuccess(200);
    expect(throttle.snapshot().delayMs).toBeGreaterThanOrEqual(100);
  });

  test("onBackpressure increases delay", () => {
    const throttle = new AdaptiveThrottle(100, 2000);
    throttle.onBackpressure();
    expect(throttle.snapshot().delayMs).toBe(230);
  });

  test("onBackpressure caps at maxDelayMs", () => {
    const throttle = new AdaptiveThrottle(50, 300);
    throttle.onBackpressure();
    throttle.onBackpressure();
    expect(throttle.snapshot().delayMs).toBeLessThanOrEqual(300);
  });
});
