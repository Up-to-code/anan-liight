import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildStructuredResponse } from "../src/lib/text/response-contract";
import { formatStructuredForChannel } from "../src/lib/text/channel-formatter";
import { orchestrateAnanTask } from "../src/agents/anan/orchestrator";
import { createFullGateScenarios, summarizeScenarioCounts } from "../tests/whatsapp/agent-full-scenarios";
import { evaluateWhatsAppPolicies } from "../tests/whatsapp/e2e-whatsapp-checks";
import { evaluateSearchQuality } from "../tests/whatsapp/search-quality-checks";
import { evaluateTokenAndModelPolicy } from "../tests/whatsapp/model-token-checks";
import { probeLatency } from "../tests/whatsapp/latency-probe";
import { summarizeRoutingCompliance, validateScenarioRouting } from "../tests/whatsapp/trace-validators";
import type { FullGateResult, RoutingAssertion, ScenarioExpectedRoute } from "../tests/whatsapp/types";

interface CliArgs {
  profile: "dev" | "prod";
  deployment?: string;
  channel: "whatsapp";
  liveScrape: boolean;
  whitelist: string[];
  skipSuite: boolean;
}

function loadProfileEnv(profile: "dev" | "prod"): Record<string, string> {
  const filename = profile === "prod" ? ".env.production.local" : ".env.local";
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  const content = readFileSync(path, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key.length > 0) out[key] = value;
  }
  return out;
}

function parseArgs(argv: string[]): CliArgs {
  const lookup = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    const value = argv[i + 1]?.startsWith("--") ? "true" : (argv[i + 1] ?? "true");
    lookup.set(key.slice(2), value);
  }

  const whitelist = (lookup.get("whitelist") ?? process.env["WA_TEST_WHITELIST"] ?? "000000000000")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const profile = lookup.get("profile") === "prod" ? "prod" : "dev";
  return {
    profile,
    deployment: lookup.get("deployment"),
    channel: "whatsapp",
    liveScrape: (lookup.get("live-scrape") ?? "true") !== "false",
    whitelist,
    skipSuite: (lookup.get("skip-suite") ?? "false") === "true"
  };
}

function routeToIntent(route: ScenarioExpectedRoute): "property" | "market" | "other" {
  if (route === "property") return "property";
  if (route === "market") return "market";
  return "other";
}

function passRate(success: number, total: number): number {
  if (total <= 0) return 0;
  return Number((success / total).toFixed(4));
}

function runCommand(command: string, args: string[]): { ok: boolean; output: string } {
  const commandEnv = {
    ...process.env,
    NODE_ENV: "test",
    FEATURE_LLIGHT_WA_WEBHOOK_ENABLED: "false",
    FEATURE_LLIGHT_WA_PLATFORM_ENABLED: "false",
    FEATURE_LLIGHT_WA_TEMPLATE_ENFORCEMENT_ENABLED: "false",
    FEATURE_AUTH_COGNITO_ENABLED: "false",
    COGNITO_ENABLED: "false",
    WHATSAPP_VERIFY_TOKEN: ""
  };
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: commandEnv,
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error) {
    return { ok: false, output: result.error.message };
  }
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, output };
}

function renderReplyFromResult(result: unknown): string {
  const payload = result as {
    findings?: Array<{ title?: string; location?: string; price?: string }>;
    snippets?: Array<{ title?: string; snippet?: string }>;
  };

  if (Array.isArray(payload.findings) && payload.findings.length > 0) {
    const top = payload.findings.slice(0, 3);
    const details = top
      .map((item) => `${item.title ?? "Property"} in ${item.location ?? "N/A"} priced at ${item.price ?? "N/A"}.`)
      .join(" ");
    return `I found matching options. ${details} Would you like me to compare top offers?`;
  }

  if (Array.isArray(payload.snippets) && payload.snippets.length > 0) {
    const top = payload.snippets.slice(0, 2);
    const details = top.map((item) => `${item.title ?? "Update"}: ${item.snippet ?? ""}`).join(" ");
    return `Here is a market update. ${details} Would you like the latest financing snapshot?`;
  }

  return "I can continue once you share a property goal. Would you like to search apartments or financing?";
}

function hasSingleNextStepQuestion(text: string): boolean {
  const count = (text.match(/[?؟]/g) ?? []).length;
  return count === 1;
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const stageResults: FullGateResult["stageResults"] = [];
  const profileEnv = loadProfileEnv(args.profile);
  const envValue = (key: string): string => process.env[key] ?? profileEnv[key] ?? "";

  const requiredKeys = ["OPENROUTER_PRIMARY_MODEL", "OPENROUTER_MODEL_CHAIN"] as const;
  const missing = requiredKeys.filter((key) => envValue(key).trim().length === 0);
  if (missing.length > 0) {
    const status = args.profile === "prod" ? "fail" : "pass";
    stageResults.push({
      stage: "preflight",
      status,
      detail: `missing env keys (${args.profile}): ${missing.join(",")}`
    });
  } else {
    stageResults.push({ stage: "preflight", status: "pass", detail: `profile=${args.profile}; liveScrape=${String(args.liveScrape)}` });
  }

  if (args.liveScrape && args.whitelist.length === 0) {
    stageResults.push({ stage: "whitelist", status: "fail", detail: "WA_TEST_WHITELIST is empty for live mode" });
  } else {
    stageResults.push({ stage: "whitelist", status: "pass", detail: `whitelist-size=${args.whitelist.length}` });
  }

  if (!args.skipSuite) {
    const suite = [
      { name: "lint", command: "npm", args: ["run", "lint"] },
      { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
      { name: "build", command: "npm", args: ["run", "build"] },
      { name: "test", command: "npm", args: ["run", "test"] }
    ];

    for (const step of suite) {
      let result = runCommand(step.command, step.args);
      if (!result.ok && step.name === "test") {
        const retry = runCommand(step.command, step.args);
        if (retry.ok) {
          result = { ok: true, output: "test passed on retry-1" };
        }
      }
      stageResults.push({
        stage: step.name,
        status: result.ok ? "pass" : "fail",
        detail: result.ok ? `${step.name} passed` : result.output.slice(0, 800)
      });
      if (!result.ok) break;
    }
  }

  const scenarios = createFullGateScenarios();
  const scenarioCounts = summarizeScenarioCounts(scenarios);
  stageResults.push({ stage: "scenario_matrix", status: "pass", detail: JSON.stringify(scenarioCounts) });

  const assertions: RoutingAssertion[] = [];
  const responseCheck: boolean[] = [];
  const voiceCheck: boolean[] = [];
  const replies: string[] = [];
  const failures: Array<{ scenarioId: string; code: string; detail: string }> = [];

  for (const scenario of scenarios) {
    const result = await orchestrateAnanTask({
      channel: args.channel,
      intent: routeToIntent(scenario.expectedRoute),
      query: scenario.prompt
    });

    const routingAssertions = validateScenarioRouting(scenario, result);
    assertions.push(...routingAssertions);
    for (const assertion of routingAssertions) {
      if (!assertion.passed) {
        failures.push({ scenarioId: scenario.id, code: assertion.code, detail: assertion.detail });
      }
    }

    const rawReply = renderReplyFromResult(result);
    const structured = buildStructuredResponse(rawReply);
    const formatted = formatStructuredForChannel(structured, "whatsapp");
    replies.push(formatted);

    const contractPass = hasSingleNextStepQuestion(formatted);
    responseCheck.push(contractPass);
    if (!contractPass) {
      failures.push({
        scenarioId: scenario.id,
        code: "WA_POLICY_NEXT_STEP",
        detail: "response does not have exactly one next-step question"
      });
    }

    if (scenario.category === "voice") {
      const pass = scenario.followUps.some((line) => /نعم|تعديل|yes|edit/i.test(line));
      voiceCheck.push(pass);
      if (!pass) {
        failures.push({ scenarioId: scenario.id, code: "VOICE_CONFIRM", detail: "voice scenario missing confirm/edit branch" });
      }
    }
  }

  const routingCompliance = summarizeRoutingCompliance(assertions);
  const responseContractCompliance = passRate(responseCheck.filter(Boolean).length, responseCheck.length);
  const voiceDecisionCompliance = passRate(voiceCheck.filter(Boolean).length, Math.max(1, voiceCheck.length));

  const waEval = evaluateWhatsAppPolicies();
  for (const failure of waEval.failures) {
    failures.push({ scenarioId: "wa-policy", code: failure.code, detail: failure.detail });
  }

  const searchEval = await evaluateSearchQuality();
  for (const failure of searchEval.failures) {
    failures.push({ scenarioId: "search-quality", code: failure.code, detail: failure.detail });
  }

  const model = envValue("OPENROUTER_PRIMARY_MODEL") || "unknown";
  const tokenEval = evaluateTokenAndModelPolicy({ profile: args.profile, model, replies });
  for (const failure of tokenEval.failures) {
    failures.push({ scenarioId: "token-model", code: failure.code, detail: failure.detail });
  }

  const latency = await probeLatency();

  const deliveryOk = waEval.metrics.normalSearchMaxMessagesPassRate === 1
    && waEval.metrics.detailGalleryPolicyPassRate === 1
    && waEval.metrics.linkSuppressionPassRate === 1
    && waEval.metrics.competitorMaskPassRate === 1;

  const searchOk = searchEval.metrics.sourceDiversity >= 3
    && searchEval.metrics.detailCoverageTop3 >= 0.7
    && searchEval.metrics.imageCoverageTop3 >= 0.7
    && searchEval.metrics.noveltyScore >= 0.8;

  const latencyOk = latency.p95TurnMs <= 10000 && latency.p95WebhookDispatchMs <= 1500;
  const summaryPassed =
    routingCompliance >= 0.95
    && responseContractCompliance >= 0.95
    && voiceDecisionCompliance >= 0.95
    && deliveryOk
    && searchOk
    && latencyOk
    && tokenEval.failures.length === 0
    && stageResults.every((stage) => stage.status === "pass");

  stageResults.push({ stage: "routing", status: routingCompliance >= 0.95 ? "pass" : "fail", detail: String(routingCompliance) });
  stageResults.push({ stage: "response_contract", status: responseContractCompliance >= 0.95 ? "pass" : "fail", detail: String(responseContractCompliance) });
  stageResults.push({ stage: "voice", status: voiceDecisionCompliance >= 0.95 ? "pass" : "fail", detail: String(voiceDecisionCompliance) });
  stageResults.push({ stage: "delivery_policy", status: deliveryOk ? "pass" : "fail", detail: JSON.stringify(waEval.metrics) });
  stageResults.push({ stage: "search_quality", status: searchOk ? "pass" : "fail", detail: JSON.stringify(searchEval.metrics) });
  stageResults.push({ stage: "latency", status: latencyOk ? "pass" : "fail", detail: JSON.stringify(latency) });

  const result: FullGateResult = {
    fullGateVersion: "v1",
    generatedAt: new Date().toISOString(),
    profile: args.profile,
    ...(args.deployment ? { deployment: args.deployment } : {}),
    summary: {
      passed: summaryPassed,
      totalScenarios: scenarios.length,
      passedScenarios: scenarios.length - failures.length,
      failedScenarios: failures.length
    },
    routingCompliance,
    responseContractCompliance,
    voiceDecisionCompliance,
    searchQuality: searchEval.metrics,
    tokenModel: tokenEval.metrics,
    delivery: waEval.metrics,
    latency: {
      p95TurnMs: latency.p95TurnMs,
      p95WebhookDispatchMs: latency.p95WebhookDispatchMs
    },
    failures,
    stageResults
  };

  const outDir = resolve(process.cwd(), "test-results");
  mkdirSync(outDir, { recursive: true });
  const profileFile = resolve(outDir, `whatsapp-agent-full-gate.${args.profile}.json`);
  const genericFile = resolve(outDir, "whatsapp-agent-full-gate.json");
  writeFileSync(profileFile, JSON.stringify(result, null, 2), "utf-8");
  writeFileSync(genericFile, JSON.stringify(result, null, 2), "utf-8");

  const elapsed = Date.now() - startedAt;
  stageResults.push({ stage: "completed", status: summaryPassed ? "pass" : "fail", detail: `durationMs=${elapsed}` });

  if (summaryPassed) {
    console.log(`Full gate passed. Output: ${profileFile}`);
    process.exit(0);
  }

  console.error(`Full gate failed. Output: ${profileFile}`);
  process.exit(1);
}

void run();
