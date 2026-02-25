import { buildSearchPlan } from "@agents/anan/search/query-planner";
import { retrieveSearchCandidates } from "@agents/anan/search/retriever";
import { selectSearchSources } from "@agents/anan/search/source-selector";
import { enrichSearchDetails } from "@agents/anan/search/detail-enricher";
import { rankSearchResults } from "@agents/anan/search/ranker";
import { evaluateSearchCoverage } from "@agents/anan/search/coverage-judge";
import { assembleSearchOutput } from "@agents/anan/search/result-assembler";
import type { SearchPipelineInput, SearchOrchestratorOutput, SearchStageTrace } from "@agents/anan/search/types";

export async function runSearchOrchestrator(input: SearchPipelineInput): Promise<SearchOrchestratorOutput> {
  const trace: SearchStageTrace[] = [];

  const stage = async <T>(name: SearchStageTrace["stage"], fn: () => Promise<T> | T): Promise<T> => {
    const startedAt = Date.now();
    try {
      const result = await fn();
      trace.push({ stage: name, status: "ok", startedAt, endedAt: Date.now() });
      return result;
    } catch (error) {
      trace.push({
        stage: name,
        status: "error",
        startedAt,
        endedAt: Date.now(),
        meta: { error: error instanceof Error ? error.message : "unknown" },
      });
      throw error;
    }
  };

  const plan = await stage("query_plan", async () => buildSearchPlan(input.query));
  const retrieved = await stage("retrieve", async () => retrieveSearchCandidates({ plan, request: input }));
  const selected = await stage("source_select", async () => selectSearchSources(retrieved));
  const enriched = await stage("detail_enrich", async () => enrichSearchDetails(selected));
  const ranked = await stage("rank", async () => rankSearchResults(enriched));
  const quality = await stage("coverage_judge", async () => evaluateSearchCoverage(ranked));
  return stage("assemble", async () =>
    assembleSearchOutput({
      query: input.query,
      findings: ranked,
      quality,
      trace,
    }),
  );
}
