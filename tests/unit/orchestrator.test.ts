import { describe, expect, test } from "vitest";
import { orchestrateAnanTask } from "@agents/anan/orchestrator/index";

describe("orchestrator", () => {
  test("intent property returns findings and quality metrics", async () => {
    const result = await orchestrateAnanTask({
      channel: "web",
      intent: "property",
      query: "apartments in Riyadh"
    });
    const typed = result as {
      query: string;
      findings: Array<{ propertyUrl: string }>;
      quality: { coverage: number; imageCoverage: number; novelty: number };
    };

    expect(typed.query).toBe("apartments in Riyadh");
    expect(typed.findings.length).toBeGreaterThan(0);
    expect(typed.quality.coverage).toBeGreaterThan(0);
    expect(typed.quality.imageCoverage).toBeGreaterThan(0);
  });

  test("intent market returns web snippets", async () => {
    const result = await orchestrateAnanTask({
      channel: "web",
      intent: "market",
      query: "Saudi real estate market trends"
    });
    const typed = result as { snippets: unknown[] };
    expect(Array.isArray(typed.snippets)).toBe(true);
    expect(typed.snippets.length).toBeGreaterThan(0);
  });

  test("intent other returns unsupported message", async () => {
    const result = await orchestrateAnanTask({
      channel: "web",
      intent: "other",
      query: "hello"
    });
    expect(result).toEqual({ message: "Unsupported intent" });
  });
});
