import type { AgentState } from "@shared/agent";
import type { TableDefinition, VersionedRow } from "@tables/types";

export interface AgentSoulRow extends VersionedRow {
  agentId: string;
  agentType: string;
  status: AgentState;
  memorySnapshotJson: string;
  lastHeartbeat: number;
  agentVersion: string;
}

export const AGENTS_TABLE: TableDefinition = {
  tableName: "agent_souls",
  createSql:
    "CREATE TABLE IF NOT EXISTS agent_souls (id TEXT PRIMARY KEY, agentId TEXT UNIQUE, agentType TEXT, status TEXT, memorySnapshotJson TEXT, lastHeartbeat BIGINT, agentVersion TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_agent_souls_status ON agent_souls(status)",
    "CREATE INDEX IF NOT EXISTS idx_agent_souls_heartbeat ON agent_souls(lastHeartbeat)"
  ]
};
