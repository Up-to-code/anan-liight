import { execFile, spawn } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { loadEnv } from "../src/lib/config/env";
import { toSpacetimeTableName } from "../src/lib/spacetime/table-name";
import { CORE_TABLE_DEFINITIONS } from "../src/tables/index";
import { syncSpacetimeModuleSchema } from "./sync-spacetimedb-module-schema";

const execFileAsync = promisify(execFile);

interface ApplyArtifact {
  timestamp: string;
  database: string;
  totalTablesAttempted: number;
  succeededTables: string[];
  failedTables: string[];
  firstError: string | null;
}

interface DescribeTable {
  name?: string;
}

interface DescribePayload {
  tables?: DescribeTable[];
}

function extractJson(raw: string): string {
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("Failed to parse describe output as JSON");
  }
  return raw.slice(jsonStart);
}

async function runPublish(input: { server: string; dbName: string; cwd: string }): Promise<void> {
  const modulePath = resolve(input.cwd, "spacetimedb");
  statSync(modulePath);
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      "spacetime",
      ["publish", "-p", "spacetimedb", "-s", input.server, input.dbName, "--delete-data=on-conflict", "-y"],
      { cwd: input.cwd, stdio: ["pipe", "pipe", "pipe"] }
    );
    const chunks: string[] = [];
    child.stdout.on("data", (data: Buffer) => chunks.push(data.toString("utf-8")));
    child.stderr.on("data", (data: Buffer) => chunks.push(data.toString("utf-8")));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(chunks.join("\n").slice(0, 1000)));
    });
    child.stdin.write("upgrade\n");
    child.stdin.end();
  });
}

async function describeTables(input: { server: string; dbName: string; cwd: string }): Promise<Set<string>> {
  const { stdout } = await execFileAsync(
    "spacetime",
    ["describe", "-s", input.server, "--json", input.dbName, "-y"],
    { cwd: input.cwd, timeout: 60_000 }
  );
  const parsed = JSON.parse(extractJson(stdout)) as DescribePayload;
  const names = (parsed.tables ?? []).map((item) => item.name).filter((name): name is string => Boolean(name));
  return new Set(names);
}

function writeArtifact(artifact: ApplyArtifact): void {
  const outDir = resolve(process.cwd(), "test-results");
  const outFile = resolve(outDir, "spacetimedb-apply.staging.json");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(artifact, null, 2), "utf-8");
  console.log(`[bootstrap] artifact written: ${outFile}`);
}

/**
 * Boots core table definitions through a Spacetime native module publish.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const cwd = process.cwd();
  const succeededTables: string[] = [];
  const failedTables: string[] = [];
  let firstError: string | null = null;
  const server = env.SPACETIMEDB_HTTP_URL.includes("maincloud.spacetimedb.com")
    ? "maincloud"
    : env.SPACETIMEDB_HTTP_URL;

  try {
    const moduleFile = syncSpacetimeModuleSchema(cwd);
    console.log(`[bootstrap] synced module schema: ${moduleFile}`);
    await runPublish({ server, dbName: env.SPACETIMEDB_DB_NAME, cwd });
    const existingTables = await describeTables({ server, dbName: env.SPACETIMEDB_DB_NAME, cwd });
    for (const definition of CORE_TABLE_DEFINITIONS) {
      const normalized = toSpacetimeTableName(definition.tableName);
      if (existingTables.has(normalized)) {
        succeededTables.push(normalized);
      } else {
        failedTables.push(normalized);
      }
    }
    if (failedTables.length > 0) {
      firstError = `Missing tables after publish: ${failedTables.slice(0, 5).join(", ")}`;
    }
  } catch (error) {
    firstError = error instanceof Error ? error.message : "unknown bootstrap error";
    failedTables.push(...CORE_TABLE_DEFINITIONS.map((definition) => definition.tableName));
  }

  const artifact: ApplyArtifact = {
    timestamp: new Date().toISOString(),
    database: env.SPACETIMEDB_DB_NAME,
    totalTablesAttempted: CORE_TABLE_DEFINITIONS.length,
    succeededTables,
    failedTables,
    firstError
  };
  writeArtifact(artifact);
  if (failedTables.length > 0) {
    console.error(`[bootstrap] failed: ${firstError ?? "unknown"}`);
    process.exit(1);
  }
  console.log(`[bootstrap] completed: ${succeededTables.length} tables ready`);
  process.exit(0);
}

void main();
