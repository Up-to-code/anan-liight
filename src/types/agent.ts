import type { AGENT_STATES, CHANNELS } from "@shared/constants";

export type AgentState = (typeof AGENT_STATES)[number];
export type Channel = (typeof CHANNELS)[number];

export interface AgentSoulRecord {
  agentId: string;
  agentType: string;
  status: AgentState;
  memorySnapshot: Record<string, string>;
  lastHeartbeat: number;
  version: number;
  updatedAt: number;
}

export interface AgentMessage {
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  topic: string;
  payload: Record<string, string>;
  createdAt: number;
  idempotencyKey: string;
}
