import { prioritizeContextFacts, type ContextFact } from "@agents/anan/context/prioritizer";

export interface ContextSummary {
  objective?: string;
  facts: ContextFact[];
  missingFields: string[];
}

export function buildContextSummary(input: {
  objective?: string;
  facts: ContextFact[];
  requiredFields?: string[];
}): ContextSummary {
  const prioritized = prioritizeContextFacts(input.facts);
  const required = input.requiredFields ?? [];
  const present = new Set(prioritized.map((fact) => fact.key));
  const missingFields = required.filter((field) => !present.has(field));
  return {
    ...(input.objective ? { objective: input.objective } : {}),
    facts: prioritized,
    missingFields,
  };
}
