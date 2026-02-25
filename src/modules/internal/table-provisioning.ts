import { toSpacetimeTableName } from "@lib/spacetime/table-name";
import type { AppEnv } from "@lib/config/env";

export type TableProvisioningState = "pending" | "ok" | "degraded" | "skipped";

export interface TableProvisioningReport {
  state: TableProvisioningState;
  checkedAt: number;
  created: string[];
  existing: string[];
  failed: Array<{ table: string; error: string }>;
}

const REQUIRED_TABLES = [
  "api_event_log",
  "webhook_event_log",
  "admin_action_audit",
  "dead_letters",
  "workflow_step_events",
  "circuit_breaker_state",
  "feature_flags",
  "wa_templates",
  "wa_campaigns",
  "user_profiles",
  "user_roles",
  "partners",
  "properties",
  "notifications",
  "session_tokens"
] as const;

function buildGenericCreateSql(table: string): string {
  return `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, payload_json TEXT, version BIGINT, created_at BIGINT, updated_at BIGINT)`;
}

function buildIndexSql(table: string): string {
  return `CREATE INDEX IF NOT EXISTS idx_${table}_updated_at ON ${table}(updated_at)`;
}

async function runSql(env: AppEnv, query: string): Promise<string> {
  const endpoint = `${env.SPACETIMEDB_HTTP_URL.replace(/\/$/, "")}/v1/database/${env.SPACETIMEDB_DB_NAME}/sql`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      ...(env.SPACETIMEDB_AUTH_TOKEN ? { Authorization: `Bearer ${env.SPACETIMEDB_AUTH_TOKEN}` } : {})
    },
    body: query
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return text;
}

async function tableExists(env: AppEnv, table: string): Promise<boolean> {
  try {
    await runSql(env, `SELECT * FROM ${table} LIMIT 1`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("no such table")) return false;
    throw error;
  }
}

/**
 * Ensures required admin dashboard tables exist in Spacetime.
 */
export async function ensureRequiredTables(env: AppEnv): Promise<TableProvisioningReport> {
  const checkedAt = Date.now();
  if (env.NODE_ENV === "test") {
    return { state: "skipped", checkedAt, created: [], existing: [], failed: [] };
  }

  const created: string[] = [];
  const existing: string[] = [];
  const failed: Array<{ table: string; error: string }> = [];

  for (const rawTable of REQUIRED_TABLES) {
    const table = toSpacetimeTableName(rawTable);
    try {
      const exists = await tableExists(env, table);
      if (exists) {
        existing.push(table);
        continue;
      }
      await runSql(env, buildGenericCreateSql(table));
      await runSql(env, buildIndexSql(table));
      created.push(table);
    } catch (error) {
      failed.push({
        table,
        error: error instanceof Error ? error.message : "unknown provisioning error"
      });
    }
  }

  return {
    state: failed.length > 0 ? "degraded" : "ok",
    checkedAt,
    created,
    existing,
    failed
  };
}
