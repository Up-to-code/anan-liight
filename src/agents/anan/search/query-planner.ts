import { detectIntentScope } from "@agents/anan/search/intent-scope";
import type { SearchPlan } from "@agents/anan/search/types";

export function buildSearchPlan(query: string): SearchPlan {
  const scope = detectIntentScope(query);
  const variants = scope === "property" ? [query, `${query} property listing`] : [query, `${query} market trends`];
  return { scope, primaryQuery: query, variants };
}
