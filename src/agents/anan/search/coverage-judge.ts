import type { PropertySearchResult } from "@agents/anan/tools/property";

export function evaluateSearchCoverage(items: PropertySearchResult["items"]): {
  coverage: number;
  imageCoverage: number;
  novelty: number;
} {
  const total = Math.max(1, items.length);
  const withUrls = items.filter((item) => item.propertyUrl.length > 0).length;
  const withImages = items.filter((item) => (item.imageUrls?.length ?? 0) > 0).length;
  return {
    coverage: Number((withUrls / total).toFixed(2)),
    imageCoverage: Number((withImages / total).toFixed(2)),
    novelty: items.length > 0 ? 1 : 0,
  };
}
