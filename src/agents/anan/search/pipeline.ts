import type { SearchPipelineInput } from "@agents/anan/search/types";
import { runSearchOrchestrator } from "@agents/anan/search/search-orchestrator";

export type SearchPipelineResult = Awaited<ReturnType<typeof runSearchOrchestrator>>;

export async function runSearchPipeline(input: SearchPipelineInput): Promise<SearchPipelineResult> {
  return runSearchOrchestrator(input);
}
