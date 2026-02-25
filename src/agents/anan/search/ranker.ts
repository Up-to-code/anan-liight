import type { PropertySearchResult } from "@agents/anan/tools/property";

export function rankSearchResults(items: PropertySearchResult["items"]): PropertySearchResult["items"] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title) || a.propertyUrl.localeCompare(b.propertyUrl));
}
