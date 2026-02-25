import type { PropertySearchResult } from "@agents/anan/tools/property";

export interface SearchResultEnvelope {
  source: "internal_db" | "web_fallback" | "web_fallback_failed";
  responseMode: "search_list" | "single_property_detail" | "general_info";
  items: PropertySearchResult["items"];
  quality: {
    coverage: number;
    imageCoverage: number;
    novelty: number;
  };
  note?: string;
}

export function toSearchResultEnvelope(input: {
  source: SearchResultEnvelope["source"];
  items: PropertySearchResult["items"];
  quality: SearchResultEnvelope["quality"];
  note?: string;
}): SearchResultEnvelope {
  return {
    source: input.source,
    responseMode: "search_list",
    items: input.items,
    quality: input.quality,
    ...(input.note ? { note: input.note } : {}),
  };
}
