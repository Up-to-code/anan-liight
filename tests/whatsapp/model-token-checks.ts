import type { TokenModelMetrics } from "./types";

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter((token) => token.length > 0).length;
  return Math.max(1, Math.round(words * 1.35));
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function isFreeModel(model: string): boolean {
  const normalized = model.toLowerCase();
  return normalized.includes(":free") || normalized.includes("(free)") || normalized.includes(" free");
}

export function evaluateTokenAndModelPolicy(input: {
  profile: "dev" | "prod";
  model: string;
  replies: string[];
}): {
  metrics: TokenModelMetrics;
  failures: Array<{ code: string; detail: string }>;
} {
  const failures: Array<{ code: string; detail: string }> = [];
  const tokens = input.replies.map((text) => estimateTokens(text));
  const avg = tokens.length === 0 ? 0 : Math.round(tokens.reduce((sum, value) => sum + value, 0) / tokens.length);
  const p95 = percentile(tokens, 95);

  const freeModelUsageCount = isFreeModel(input.model) ? 1 : 0;
  if (input.profile === "prod" && freeModelUsageCount > 0) {
    failures.push({ code: "TOKEN_FREE_MODEL_PROD", detail: `prod model is free-like: ${input.model}` });
  }
  if (p95 > 6500) failures.push({ code: "TOKEN_P95_LIMIT", detail: `p95=${p95}` });
  if (avg > 4000) failures.push({ code: "TOKEN_AVG_LIMIT", detail: `avg=${avg}` });

  return {
    metrics: {
      averageTokensPerTurn: avg,
      p95TokensPerTurn: p95,
      freeModelUsageCount,
      model: input.model
    },
    failures
  };
}
