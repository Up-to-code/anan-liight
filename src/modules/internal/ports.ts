import { randomUUID } from "node:crypto";
import type { AgentMessageBusPort, AgentPersistencePort, AgentSchedulerPort } from "@agents/types";
import type { AgentMessage } from "@shared/agent";
import { TABLE_NAMES } from "@shared/constants";
import type { SpacetimeStore } from "@modules/internal/spacetime-store";
import type { WorkflowPersistencePort } from "@workflows/types";
import type { WorkflowStepRecord } from "@shared/workflow";

export class AgentPersistenceAdapter implements AgentPersistencePort {
  public constructor(private readonly store: SpacetimeStore) {}

  public async upsertSoul(record: {
    agentId: string;
    agentType: string;
    status: string;
    memorySnapshot: Record<string, string>;
    lastHeartbeat: number;
    version: number;
    updatedAt: number;
  }): Promise<void> {
    await this.store.insert(TABLE_NAMES.AGENT_SOULS, {
      id: randomUUID(),
      ...record,
      memorySnapshotJson: JSON.stringify(record.memorySnapshot),
      agentVersion: String(record.version),
      version: record.version,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await this.store.insert(TABLE_NAMES.AGENT_TRACES, {
      id: randomUUID(),
      agentId: record.agentId,
      event: "soul_upsert",
      payload: JSON.stringify(record),
      createdAt: Date.now()
    });
  }

  public async logLifecycleEvent(input: {
    agentId: string;
    fromState: string;
    toState: string;
    reason: string;
    timestamp: number;
  }): Promise<void> {
    await this.store.insert(TABLE_NAMES.AGENT_LIFECYCLE_EVENTS, {
      id: randomUUID(),
      eventId: randomUUID(),
      ...input,
      version: 1,
      createdAt: input.timestamp,
      updatedAt: input.timestamp
    });
  }
}

export class MessageBusAdapter implements AgentMessageBusPort {
  public constructor(private readonly store: SpacetimeStore) {}

  public async publish(message: AgentMessage): Promise<void> {
    await this.store.insert(TABLE_NAMES.OUTBOX_EVENTS, {
      id: randomUUID(),
      eventId: message.messageId,
      topic: `agent:${message.toAgentId}:${message.topic}`,
      payloadJson: JSON.stringify(message),
      status: "PENDING",
      idempotencyKey: message.idempotencyKey,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  public async consume(agentId: string, limit: number): Promise<AgentMessage[]> {
    const rows = await this.store.queryMany<{ payloadJson: string }>(
      TABLE_NAMES.OUTBOX_EVENTS,
      [{ field: "topic", op: "eq", value: `agent:${agentId}:inbox` }],
      limit
    );

    return rows.flatMap((row) => {
      try {
        const parsed = JSON.parse(row.payloadJson) as AgentMessage;
        return [parsed];
      } catch {
        return [];
      }
    });
  }
}

export class SchedulerAdapter implements AgentSchedulerPort {
  public constructor(private readonly store: SpacetimeStore) {}

  public async schedule(input: {
    jobId: string;
    queueName: string;
    payloadJson: string;
    runAt: number;
    idempotencyKey: string;
  }): Promise<void> {
    await this.store.insert(TABLE_NAMES.SCHEDULER_JOBS, {
      id: randomUUID(),
      ...input,
      status: "SCHEDULED",
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  public async pullDueJobs(
    queueName: string,
    _now: number,
    limit: number
  ): Promise<Array<{ jobId: string; payloadJson: string; runAt?: number; status?: string }>> {
    const rows = await this.store.queryMany<{ jobId: string; payloadJson: string; runAt?: number; status?: string }>(
      TABLE_NAMES.SCHEDULER_JOBS,
      [
        { field: "queueName", op: "eq", value: queueName },
        { field: "status", op: "eq", value: "SCHEDULED" }
      ],
      limit
    );
    return rows;
  }

  public async markCompleted(jobId: string): Promise<void> {
    const row = await this.store.queryOne<{ id: string; version: number }>(TABLE_NAMES.SCHEDULER_JOBS, [
      { field: "jobId", op: "eq", value: jobId }
    ]);
    if (row) {
      await this.store.updateVersioned(TABLE_NAMES.SCHEDULER_JOBS, row.id, row.version, {
        status: "COMPLETED",
        version: row.version + 1,
        updatedAt: Date.now()
      });
    }

    await this.store.insert(TABLE_NAMES.WORKFLOW_STEP_EVENTS, {
      id: randomUUID(),
      eventId: randomUUID(),
      jobId,
      status: "COMPLETED",
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  public async markFailed(jobId: string, reason: string): Promise<void> {
    const row = await this.store.queryOne<{ id: string; version: number }>(TABLE_NAMES.SCHEDULER_JOBS, [
      { field: "jobId", op: "eq", value: jobId }
    ]);
    if (row) {
      await this.store.updateVersioned(TABLE_NAMES.SCHEDULER_JOBS, row.id, row.version, {
        status: "FAILED",
        version: row.version + 1,
        updatedAt: Date.now()
      });
    }

    await this.store.insert(TABLE_NAMES.WORKFLOW_STEP_EVENTS, {
      id: randomUUID(),
      eventId: randomUUID(),
      jobId,
      status: "FAILED",
      reason,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
}

export class WorkflowPersistenceAdapter implements WorkflowPersistencePort {
  public constructor(private readonly store: SpacetimeStore) {}

  public async createRun(input: { workflowRunId: string; name: string; idempotencyKey: string }): Promise<void> {
    await this.store.insert(TABLE_NAMES.WORKFLOW_STEP_EVENTS, {
      id: randomUUID(),
      eventId: randomUUID(),
      workflowRunId: input.workflowRunId,
      stepId: "__run__",
      state: "PENDING",
      payloadJson: JSON.stringify(input),
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  public async markRunStatus(workflowRunId: string, status: "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"): Promise<void> {
    await this.store.insert(TABLE_NAMES.WORKFLOW_STEP_EVENTS, {
      id: randomUUID(),
      eventId: randomUUID(),
      workflowRunId,
      stepId: "__run_status__",
      state: status,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  public async upsertStep(step: WorkflowStepRecord): Promise<void> {
    await this.store.insert(TABLE_NAMES.WORKFLOW_STEP_EVENTS, {
      id: randomUUID(),
      eventId: randomUUID(),
      workflowRunId: step.workflowRunId,
      stepId: step.stepId,
      state: step.state,
      attempt: step.attempt,
      roundType: step.roundType,
      round: step.round,
      model: step.model,
      cooldownState: step.cooldownState,
      retryDelayMs: step.retryDelayMs,
      errorCode: step.errorCode,
      errorMessage: step.errorMessage,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  public async logStepAttempt(input: {
    workflowRunId: string;
    stepId: string;
    attempt: number;
    roundType: "immediate" | "scheduled";
    round: number;
    model?: string;
    cooldownState?: "closed" | "open" | "half_open";
    retryDelayMs?: number;
    status: "RUNNING" | "SUCCEEDED" | "FAILED";
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    await this.store.insert(TABLE_NAMES.WORKFLOW_STEP_EVENTS, {
      id: randomUUID(),
      eventId: randomUUID(),
      workflowRunId: input.workflowRunId,
      stepId: input.stepId,
      state: input.status,
      attempt: input.attempt,
      roundType: input.roundType,
      round: input.round,
      model: input.model,
      cooldownState: input.cooldownState,
      retryDelayMs: input.retryDelayMs,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
}
