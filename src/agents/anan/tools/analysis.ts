export interface SearchQualityMetrics {
  detailCoverage: number;
  imageCoverage: number;
  noveltyScore: number;
}

export function judgeSearchCoverage(metrics: SearchQualityMetrics): {
  status: "good" | "needs_second_pass";
  nextActions: string[];
} {
  const nextActions: string[] = [];
  if (metrics.detailCoverage < 0.6) nextActions.push("enrich_details_top_k");
  if (metrics.imageCoverage < 0.6) nextActions.push("enrich_images_top_k");
  if (metrics.noveltyScore < 0.8) nextActions.push("exclude_seen_and_refresh_query");
  return {
    status: nextActions.length === 0 ? "good" : "needs_second_pass",
    nextActions,
  };
}
