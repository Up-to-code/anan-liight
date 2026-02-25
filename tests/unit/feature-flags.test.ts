import { describe, expect, test } from "vitest";
import { isFeatureEnabled } from "@modules/internal/feature-flags";

const createMockRuntime = (env: Record<string, boolean>) =>
  ({ env }) as unknown as Parameters<typeof isFeatureEnabled>[0];

describe("isFeatureEnabled", () => {
  test("returns true when flag is true", () => {
    const runtime = createMockRuntime({
      FEATURE_LLIGHT_AGENT_RUNTIME_ENABLED: true
    });
    expect(isFeatureEnabled(runtime, "FEATURE_LLIGHT_AGENT_RUNTIME_ENABLED")).toBe(true);
  });

  test("returns false when flag is false", () => {
    const runtime = createMockRuntime({
      FEATURE_LLIGHT_AGENT_RUNTIME_ENABLED: false
    });
    expect(isFeatureEnabled(runtime, "FEATURE_LLIGHT_AGENT_RUNTIME_ENABLED")).toBe(false);
  });
});
