import type { PropertySearchResult } from "@agents/anan/tools/property";
import type { SearchOrchestratorOutput, SearchStageTrace } from "@agents/anan/search/types";

export function assembleSearchOutput(input: {
  query: string;
  findings: PropertySearchResult["items"];
  quality: SearchOrchestratorOutput["quality"];
  trace: SearchStageTrace[];
}): SearchOrchestratorOutput {
  return {
    query: input.query,
    findings: input.findings,
    quality: input.quality,
    trace: input.trace,
  };
}
