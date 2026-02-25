import { describe, expect, test } from "vitest";
import { runSearchPipeline } from "@agents/anan/search/pipeline";

describe("search pipeline", () => {
  test("runSearchPipeline returns SearchPipelineResult with query echoed", async () => {
    const result = await runSearchPipeline({ query: "apartments in Riyadh" });
    expect(result.query).toBe("apartments in Riyadh");
  });

  test("runSearchPipeline returns findings for property intent", async () => {
    const result = await runSearchPipeline({ query: "apartments in Riyadh" });
    expect(result.findings.length).toBeGreaterThan(0);
  });

  test("runSearchPipeline returns quality metrics with non-zero coverage", async () => {
    const result = await runSearchPipeline({ query: "villa in Dubai" });
    expect(result.quality.coverage).toBeGreaterThan(0);
    expect(result.quality.imageCoverage).toBeGreaterThan(0);
    expect(result.quality.novelty).toBeGreaterThan(0);
  });
});
