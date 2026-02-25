import type { AgentMessage, AgentSoulRecord, AgentState } from "@shared/agent";

export interface AgentPersistencePort {
  upsertSoul(record: AgentSoulRecord): Promise<void>;
  logLifecycleEvent(input: {
    agentId: string;
    fromState: AgentState;
    toState: AgentState;
    reason: string;
    timestamp: number;
  }): Promise<void>;
}

export interface AgentMessageBusPort {
  publish(message: AgentMessage): Promise<void>;
  consume(agentId: string, limit: number): Promise<AgentMessage[]>;
}

export interface AgentSchedulerPort {
  schedule(input: {
    jobId: string;
    queueName: string;
    payloadJson: string;
    runAt: number;
    idempotencyKey: string;
  }): Promise<void>;
  pullDueJobs(
    queueName: string,
    now: number,
    limit: number
  ): Promise<Array<{ jobId: string; payloadJson: string; runAt?: number; status?: string }>>;
  markCompleted(jobId: string): Promise<void>;
  markFailed(jobId: string, reason: string): Promise<void>;
}
