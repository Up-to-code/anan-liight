import type { FullGateScenario, RoutingAssertion } from "./types";

interface PropertyShape {
  findings?: Array<{ propertyUrl?: string; imageUrls?: string[] }>;
  trace?: Array<{ stage?: string }>;
  snippets?: Array<unknown>;
}

function assertPropertyRoute(result: PropertyShape): RoutingAssertion[] {
  const findings = result.findings ?? [];
  const traceStages = new Set((result.trace ?? []).map((entry) => entry.stage));
  return [
    {
      code: "ROUTE_PROPERTY_FINDINGS",
      passed: findings.length > 0,
      detail: findings.length > 0 ? "property findings detected" : "no property findings"
    },
    {
      code: "ROUTE_PROPERTY_TRACE",
      passed: traceStages.has("retrieve") && traceStages.has("assemble"),
      detail: `stages=${[...traceStages].join(",")}`
    }
  ];
}

function assertMarketRoute(result: PropertyShape): RoutingAssertion[] {
  const snippets = result.snippets ?? [];
  return [
    {
      code: "ROUTE_MARKET_SNIPPETS",
      passed: snippets.length > 0,
      detail: snippets.length > 0 ? "market snippets detected" : "no market snippets"
    }
  ];
}

function assertOtherRoute(result: PropertyShape): RoutingAssertion[] {
  const hasFindings = (result.findings ?? []).length > 0;
  const hasSnippets = (result.snippets ?? []).length > 0;
  return [
    {
      code: "ROUTE_OTHER_ISOLATION",
      passed: !hasFindings && !hasSnippets,
      detail: `findings=${hasFindings}; snippets=${hasSnippets}`
    }
  ];
}

export function validateScenarioRouting(
  scenario: FullGateScenario,
  result: unknown
): RoutingAssertion[] {
  const typed = (result ?? {}) as PropertyShape;
  if (scenario.expectedRoute === "property") return assertPropertyRoute(typed);
  if (scenario.expectedRoute === "market") return assertMarketRoute(typed);
  return assertOtherRoute(typed);
}

export function summarizeRoutingCompliance(assertions: RoutingAssertion[]): number {
  if (assertions.length === 0) return 0;
  const passed = assertions.filter((item) => item.passed).length;
  return Number((passed / assertions.length).toFixed(4));
}
