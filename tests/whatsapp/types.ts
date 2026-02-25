export type FullGateCategory =
  | "routing"
  | "memory"
  | "multi_turn"
  | "search_scrape"
  | "voice"
  | "wa_policy"
  | "failure_fallback";

export type ScenarioExpectedRoute = "property" | "market" | "other";

export interface FullGateScenario {
  id: string;
  category: FullGateCategory;
  prompt: string;
  followUps: string[];
  language: "ar" | "en";
  expectedRoute: ScenarioExpectedRoute;
  requiresLinks: boolean;
}

export interface RoutingAssertion {
  code: string;
  passed: boolean;
  detail: string;
}

export interface ScrapeQualityMetrics {
  sourceDiversity: number;
  detailCoverageTop3: number;
  imageCoverageTop3: number;
  noveltyScore: number;
}

export interface TokenModelMetrics {
  averageTokensPerTurn: number;
  p95TokensPerTurn: number;
  freeModelUsageCount: number;
  model: string;
}

export interface WhatsAppDeliveryMetrics {
  normalSearchMaxMessagesPassRate: number;
  detailGalleryPolicyPassRate: number;
  linkSuppressionPassRate: number;
  competitorMaskPassRate: number;
}

export interface FullGateResult {
  fullGateVersion: string;
  generatedAt: string;
  profile: "dev" | "prod";
  deployment?: string;
  summary: {
    passed: boolean;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
  };
  routingCompliance: number;
  responseContractCompliance: number;
  voiceDecisionCompliance: number;
  searchQuality: ScrapeQualityMetrics;
  tokenModel: TokenModelMetrics;
  delivery: WhatsAppDeliveryMetrics;
  latency: {
    p95TurnMs: number;
    p95WebhookDispatchMs: number;
  };
  failures: Array<{ scenarioId: string; code: string; detail: string }>;
  stageResults: Array<{ stage: string; status: "pass" | "fail"; detail: string }>;
}
