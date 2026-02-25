import type { TableDefinition } from "@tables/types";

export const SYSTEM_TABLES: TableDefinition[] = [
  {
    tableName: "agent_lifecycle_events",
    createSql:
      "CREATE TABLE IF NOT EXISTS agent_lifecycle_events (id TEXT PRIMARY KEY, eventId TEXT UNIQUE, agentId TEXT, fromState TEXT, toState TEXT, reason TEXT, timestamp BIGINT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_agent_lifecycle_agent ON agent_lifecycle_events(agentId)",
      "CREATE INDEX IF NOT EXISTS idx_agent_lifecycle_ts ON agent_lifecycle_events(timestamp)"
    ]
  },
  {
    tableName: "workflow_step_events",
    createSql:
      "CREATE TABLE IF NOT EXISTS workflow_step_events (id TEXT PRIMARY KEY, eventId TEXT UNIQUE, workflowRunId TEXT, stepId TEXT, state TEXT, attempt INTEGER, roundType TEXT, round INTEGER, model TEXT, cooldownState TEXT, retryDelayMs INTEGER, errorCode TEXT, errorMessage TEXT, reason TEXT, payloadJson TEXT, jobId TEXT, status TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_workflow_events_run ON workflow_step_events(workflowRunId)",
      "CREATE INDEX IF NOT EXISTS idx_workflow_events_step ON workflow_step_events(stepId)"
    ]
  },
  {
    tableName: "circuit_breaker_state",
    createSql:
      "CREATE TABLE IF NOT EXISTS circuit_breaker_state (id TEXT PRIMARY KEY, circuit TEXT UNIQUE, failures INTEGER, openedAt BIGINT, status TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: ["CREATE INDEX IF NOT EXISTS idx_circuit_status ON circuit_breaker_state(status)"]
  },
  {
    tableName: "feature_flags",
    createSql:
      "CREATE TABLE IF NOT EXISTS feature_flags (id TEXT PRIMARY KEY, flagKey TEXT UNIQUE, enabled BOOLEAN, source TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: ["CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled)"]
  }
];
