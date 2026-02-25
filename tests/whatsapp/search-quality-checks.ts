import { runSearchPipeline } from "@agents/anan/search/pipeline";
import { searchProperties } from "@agents/anan/tools/property";
import type { ScrapeQualityMetrics } from "./types";

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

export async function evaluateSearchQuality(): Promise<{
  metrics: ScrapeQualityMetrics;
  failures: Array<{ code: string; detail: string }>;
}> {
  const failures: Array<{ code: string; detail: string }> = [];

  const first = await runSearchPipeline({ query: "apartments" });
  const top3 = first.findings.slice(0, 3);
  const domains = new Set(top3.map((item) => parseDomain(item.propertyUrl)).filter((value) => value.length > 0));
  const detailCoverage = ratio(top3.filter((item) => item.propertyUrl.length > 0).length, Math.max(1, top3.length));
  const imageCoverage = ratio(top3.filter((item) => (item.imageUrls?.length ?? 0) > 0).length, Math.max(1, top3.length));

  const excluded = top3.map((item) => item.propertyUrl);
  const more = await searchProperties({ query: "apartments", excludeUrls: excluded });
  const priorSet = new Set(excluded);
  const moreTop3 = more.items.slice(0, 3);
  const novelty = ratio(
    moreTop3.filter((item) => !priorSet.has(item.propertyUrl)).length,
    Math.max(1, moreTop3.length)
  );

  if (domains.size < 3) failures.push({ code: "SCRAPE_DIVERSITY", detail: `domains=${domains.size}` });
  if (detailCoverage < 0.7) failures.push({ code: "SCRAPE_DETAIL_COVERAGE", detail: `detailCoverage=${detailCoverage}` });
  if (imageCoverage < 0.7) failures.push({ code: "SCRAPE_IMAGE_COVERAGE", detail: `imageCoverage=${imageCoverage}` });
  if (novelty < 0.8) failures.push({ code: "SCRAPE_NOVELTY", detail: `novelty=${novelty}` });

  return {
    metrics: {
      sourceDiversity: domains.size,
      detailCoverageTop3: detailCoverage,
      imageCoverageTop3: imageCoverage,
      noveltyScore: novelty
    },
    failures
  };
}
