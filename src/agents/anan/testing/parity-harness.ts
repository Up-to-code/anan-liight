import { buildAnanInstructions } from "@agents/anan/instructions";
import { runSearchPipeline } from "@agents/anan/search/pipeline";

export interface ParityHarnessResult {
  promptVersion: string;
  hasRoutingRules: boolean;
  hasResponseContract: boolean;
  pipelineResultShapeOk: boolean;
}

export async function runParityHarness(query: string): Promise<ParityHarnessResult> {
  const prompt = buildAnanInstructions("app");
  const result = await runSearchPipeline({ query });

  return {
    promptVersion: /PROMPT_POLICY_VERSION=([^\n]+)/.exec(prompt)?.[1] ?? "unknown",
    hasRoutingRules: prompt.toLowerCase().includes("property listing") || prompt.toLowerCase().includes("routing"),
    hasResponseContract: prompt.toLowerCase().includes("next-step") || prompt.toLowerCase().includes("next step"),
    pipelineResultShapeOk:
      Array.isArray(result.findings) &&
      typeof result.quality.coverage === "number" &&
      typeof result.quality.imageCoverage === "number" &&
      typeof result.quality.novelty === "number",
  };
}
