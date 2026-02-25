import type { PropertySearchInput, PropertySearchResult } from "@agents/anan/tools/property";

export type IntentScope = "property" | "general";

export interface SearchStageTrace {
  stage:
    | "intent_scope"
    | "query_plan"
    | "retrieve"
    | "source_select"
    | "detail_enrich"
    | "rank"
    | "coverage_judge"
    | "assemble";
  status: "ok" | "error";
  startedAt: number;
  endedAt: number;
  meta?: Record<string, string | number | boolean>;
}

export interface SearchPlan {
  scope: IntentScope;
  primaryQuery: string;
  variants: string[];
}

export interface SearchOrchestratorOutput {
  query: string;
  findings: PropertySearchResult["items"];
  quality: { coverage: number; imageCoverage: number; novelty: number };
  trace: SearchStageTrace[];
}

export type SearchPipelineInput = PropertySearchInput;
