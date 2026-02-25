import { searchProperties, type PropertySearchInput, type PropertySearchResult } from "@agents/anan/tools/property";
import { searchWebInfo } from "@agents/anan/tools/web";
import type { SearchPlan } from "@agents/anan/search/types";

export async function retrieveSearchCandidates(input: {
  plan: SearchPlan;
  request: PropertySearchInput;
}): Promise<PropertySearchResult["items"]> {
  if (input.plan.scope === "property") {
    const result = await searchProperties(input.request);
    return result.items;
  }

  const web = await searchWebInfo({ query: input.plan.primaryQuery, num: 6 });
  return web.snippets.map((item) => ({
    title: item.title,
    propertyUrl: "",
  }));
}
