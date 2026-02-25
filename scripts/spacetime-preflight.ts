import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EXIT_CODES = {
  OK: 0,
  MISSING_KEYS: 21,
  INVALID_ENV: 22,
  UNSAFE_FLAGS: 23,
  MODEL_POLICY: 24
} as const;

type Profile = "dev" | "prod";

interface ParsedArgs {
  profile: Profile;
  envFile: string;
  json: boolean;
}

interface PreflightSummary {
  profile: Profile;
  envFile: string;
  checkedAt: string;
  missingKeys: string[];
  invalidKeys: string[];
  unsafeFlags: Array<{ key: string; expected: string; actual: string }>;
  securityIssues: string[];
  modelPolicy: {
    primaryModelSet: boolean;
    hasFreeModelsInChain: boolean;
    freeModelHits: string[];
  };
}

function parseArgs(argv: string[]): ParsedArgs {
  const lookup = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    const value = argv[i + 1]?.startsWith("--") ? "true" : (argv[i + 1] ?? "true");
    lookup.set(key.slice(2), value);
  }

  const profile = lookup.get("profile") === "prod" ? "prod" : "dev";
  const envFile = lookup.get("env-file")
    ? resolve(process.cwd(), lookup.get("env-file") as string)
    : resolve(process.cwd(), profile === "prod" ? ".env.production.local" : ".env.local");

  return {
    profile,
    envFile,
    json: (lookup.get("json") ?? "false") === "true"
  };
}

function parseEnvFile(envFile: string): Record<string, string> {
  if (!existsSync(envFile)) {
    throw new Error(`env file not found: ${envFile}`);
  }

  const content = readFileSync(envFile, "utf-8");
  const rows = content.split(/\r?\n/);
  const out: Record<string, string> = {};

  for (const row of rows) {
    const line = row.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    const value = rawValue.replace(/^['\"]/, "").replace(/['\"]$/, "");
    out[key] = value;
  }

  return out;
}

function asBool(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function checkPreflight(input: { profile: Profile; envFile: string; env: Record<string, string> }): PreflightSummary {
  const required = [
    "SPACETIMEDB_HTTP_URL",
    "SPACETIMEDB_DB_NAME",
    "SPACETIMEDB_AUTH_TOKEN",
    "APP_HOST",
    "APP_PORT"
  ] as const;

  const missingKeys = required.filter((key) => (input.env[key] ?? "").trim().length === 0);
  const invalidKeys: string[] = [];

  const http = input.env["SPACETIMEDB_HTTP_URL"] ?? "";
  if (http.length > 0) {
    try {
      new URL(http);
    } catch {
      invalidKeys.push("SPACETIMEDB_HTTP_URL");
    }
  }

  const portRaw = input.env["APP_PORT"] ?? "";
  if (portRaw.length > 0 && (!/^\d+$/.test(portRaw) || Number(portRaw) <= 0)) {
    invalidKeys.push("APP_PORT");
  }

  const unsafeFlags: Array<{ key: string; expected: string; actual: string }> = [];
  const securityIssues: string[] = [];
  const dualRun = input.env["FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED"] ?? "false";
  const readCutover = input.env["FEATURE_LLIGHT_READ_CUTOVER_ENABLED"] ?? "false";
  if (asBool(dualRun)) {
    unsafeFlags.push({ key: "FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED", expected: "false", actual: dualRun });
  }
  if (asBool(readCutover)) {
    unsafeFlags.push({ key: "FEATURE_LLIGHT_READ_CUTOVER_ENABLED", expected: "false", actual: readCutover });
  }
  if (input.profile === "prod" && asBool(input.env["FEATURE_LLIGHT_WA_WEBHOOK_ENABLED"] ?? "false")) {
    const verifyToken = (input.env["WHATSAPP_VERIFY_TOKEN"] ?? "").trim().toLowerCase();
    const weakDefaults = new Set(["apptest", "test", "changeme", "default", "123456"]);
    if (verifyToken.length < 16 || weakDefaults.has(verifyToken)) {
      securityIssues.push("WHATSAPP_VERIFY_TOKEN is weak/default for production webhook mode");
    }
  }

  const primaryModel = input.env["OPENROUTER_PRIMARY_MODEL"] ?? "";
  const chain = (input.env["OPENROUTER_MODEL_CHAIN"] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const freeHits = chain.filter((model) => {
    const normalized = model.toLowerCase();
    return normalized.includes(":free") || normalized.includes("(free)") || normalized.includes(" free");
  });

  return {
    profile: input.profile,
    envFile: input.envFile,
    checkedAt: new Date().toISOString(),
    missingKeys,
    invalidKeys,
    unsafeFlags,
    securityIssues,
    modelPolicy: {
      primaryModelSet: primaryModel.trim().length > 0,
      hasFreeModelsInChain: freeHits.length > 0,
      freeModelHits: freeHits
    }
  };
}

function printSummary(summary: PreflightSummary, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`[preflight] profile=${summary.profile} envFile=${summary.envFile}`);
  console.log(`[preflight] missingKeys=${summary.missingKeys.length}`);
  console.log(`[preflight] invalidKeys=${summary.invalidKeys.length}`);
  console.log(`[preflight] unsafeFlags=${summary.unsafeFlags.length}`);
  console.log(`[preflight] securityIssues=${summary.securityIssues.length}`);
  console.log(`[preflight] primaryModelSet=${String(summary.modelPolicy.primaryModelSet)}`);
  console.log(`[preflight] freeModelsInChain=${String(summary.modelPolicy.hasFreeModelsInChain)}`);

  if (summary.missingKeys.length > 0) {
    console.error(`[preflight] missing: ${summary.missingKeys.join(", ")}`);
  }
  if (summary.invalidKeys.length > 0) {
    console.error(`[preflight] invalid: ${summary.invalidKeys.join(", ")}`);
  }
  if (summary.unsafeFlags.length > 0) {
    console.error(
      `[preflight] unsafe flags: ${summary.unsafeFlags
        .map((item) => `${item.key}=${item.actual} (expected ${item.expected})`)
        .join("; ")}`
    );
  }
  if (summary.securityIssues.length > 0) {
    console.error(`[preflight] security issues: ${summary.securityIssues.join("; ")}`);
  }
  if (!summary.modelPolicy.primaryModelSet) {
    console.error("[preflight] OPENROUTER_PRIMARY_MODEL is required");
  }
  if (summary.modelPolicy.hasFreeModelsInChain) {
    console.error(`[preflight] free models in chain: ${summary.modelPolicy.freeModelHits.join(", ")}`);
  }
}

function resolveExit(summary: PreflightSummary): number {
  if (summary.missingKeys.length > 0) return EXIT_CODES.MISSING_KEYS;
  if (summary.invalidKeys.length > 0) return EXIT_CODES.INVALID_ENV;
  if (summary.unsafeFlags.length > 0) return EXIT_CODES.UNSAFE_FLAGS;
  if (summary.securityIssues.length > 0) return EXIT_CODES.UNSAFE_FLAGS;
  if (!summary.modelPolicy.primaryModelSet || summary.modelPolicy.hasFreeModelsInChain) {
    return EXIT_CODES.MODEL_POLICY;
  }
  return EXIT_CODES.OK;
}

function main(): never {
  const args = parseArgs(process.argv.slice(2));
  try {
    const env = parseEnvFile(args.envFile);
    const summary = checkPreflight({ profile: args.profile, envFile: args.envFile, env });
    printSummary(summary, args.json);
    process.exit(resolveExit(summary));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown preflight error";
    console.error(`[preflight] ${message}`);
    process.exit(EXIT_CODES.INVALID_ENV);
  }
}

main();
