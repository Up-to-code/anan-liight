import type { PropertySearchResult } from "@agents/anan/tools/property";

export function selectSearchSources(items: PropertySearchResult["items"]): PropertySearchResult["items"] {
  const seen = new Set<string>();
  const selected: PropertySearchResult["items"] = [];
  for (const item of items) {
    const key = `${item.title}:${item.propertyUrl}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(item);
  }
  return selected;
}
