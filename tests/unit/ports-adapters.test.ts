import { describe, expect, test, vi } from "vitest";
import {
  AgentPersistenceAdapter,
  MessageBusAdapter,
  SchedulerAdapter,
  WorkflowPersistenceAdapter
} from "@modules/internal/ports";
import type { SpacetimeStore } from "@modules/internal/spacetime-store";
import { TABLE_NAMES } from "@shared/constants";

function createMockStore(): SpacetimeStore & {
  inserts: Array<{ table: string }>;
  setQueryManyResult: (r: unknown[]) => void;
} {
  const inserts: Array<{ table: string }> = [];
  let queryManyResult: unknown[] = [];
  const store = {
    inserts,
    setQueryManyResult: (r: unknown[]) => {
      queryManyResult = r;
    },
    insert: vi.fn(async (table: string, _row?: unknown) => {
      inserts.push({ table });
    }) as SpacetimeStore["insert"],
    queryOne: vi.fn().mockResolvedValue(null) as SpacetimeStore["queryOne"],
    queryMany: vi.fn(async () => queryManyResult) as SpacetimeStore["queryMany"],
    updateVersioned: vi.fn().mockResolvedValue(true) as SpacetimeStore["updateVersioned"]
  };
  return store as SpacetimeStore & typeof store;
}

describe("AgentPersistenceAdapter", () => {
  test("upsertSoul inserts to AGENT_SOULS and AGENT_TRACES", async () => {
    const store = createMockStore();
    const adapter = new AgentPersistenceAdapter(store);
    await adapter.upsertSoul({
      agentId: "a1",
      agentType: "assistant",
      status: "RUNNING",
      memorySnapshot: {},
      lastHeartbeat: Date.now(),
      version: 1,
      updatedAt: Date.now()
    });
    expect(store.inserts).toHaveLength(2);
    expect(store.inserts.map((i) => i.table)).toContain(TABLE_NAMES.AGENT_SOULS);
    expect(store.inserts.map((i) => i.table)).toContain(TABLE_NAMES.AGENT_TRACES);
  });

  test("logLifecycleEvent inserts to AGENT_LIFECYCLE_EVENTS", async () => {
    const store = createMockStore();
    const adapter = new AgentPersistenceAdapter(store);
    await adapter.logLifecycleEvent({
      agentId: "a1",
      fromState: "IDLE",
      toState: "RUNNING",
      reason: "started",
      timestamp: Date.now()
    });
    expect(store.inserts.some((i) => i.table === TABLE_NAMES.AGENT_LIFECYCLE_EVENTS)).toBe(true);
  });
});

describe("MessageBusAdapter", () => {
  test("publish inserts to OUTBOX_EVENTS with correct topic", async () => {
    const store = createMockStore();
    const adapter = new MessageBusAdapter(store);
    await adapter.publish({
      messageId: "m1",
      fromAgentId: "source",
      toAgentId: "agent-1",
      topic: "inbox",
      payload: {},
      createdAt: Date.now(),
      idempotencyKey: "key1"
    });
    expect(store.insert).toHaveBeenCalledWith(
      TABLE_NAMES.OUTBOX_EVENTS,
      expect.objectContaining({
        topic: "agent:agent-1:inbox"
      })
    );
  });

  test("consume returns parsed messages from query", async () => {
    const store = createMockStore();
    store.setQueryManyResult([
      {
        payloadJson: JSON.stringify({
          messageId: "m1",
          fromAgentId: "src",
          toAgentId: "a",
          topic: "inbox",
          payload: {},
          createdAt: Date.now(),
          idempotencyKey: "k"
        })
      }
    ]);
    const adapter = new MessageBusAdapter(store);
    const messages = await adapter.consume("a1", 10);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe("m1");
  });
});

describe("SchedulerAdapter", () => {
  test("schedule inserts to SCHEDULER_JOBS", async () => {
    const store = createMockStore();
    const adapter = new SchedulerAdapter(store);
    await adapter.schedule({
      jobId: "j1",
      queueName: "q1",
      payloadJson: "{}",
      runAt: Date.now(),
      idempotencyKey: "k1"
    });
    expect(store.insert).toHaveBeenCalledWith(
      TABLE_NAMES.SCHEDULER_JOBS,
      expect.objectContaining({
        jobId: "j1",
        status: "SCHEDULED"
      })
    );
  });

  test("pullDueJobs returns rows from query", async () => {
    const store = createMockStore();
    store.setQueryManyResult([{ jobId: "j1", payloadJson: "{}" }]);
    const adapter = new SchedulerAdapter(store);
    const jobs = await adapter.pullDueJobs("q1", Date.now(), 10);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.jobId).toBe("j1");
  });

  test("markCompleted calls updateVersioned", async () => {
    const store = createMockStore();
    vi.mocked(store.queryOne).mockResolvedValueOnce({ id: "row-1", version: 1 });
    const adapter = new SchedulerAdapter(store);
    await adapter.markCompleted("j1");
    expect(store.updateVersioned).toHaveBeenCalled();
  });
});

describe("WorkflowPersistenceAdapter", () => {
  test("createRun inserts to WORKFLOW_STEP_EVENTS", async () => {
    const store = createMockStore();
    const adapter = new WorkflowPersistenceAdapter(store);
    await adapter.createRun({
      workflowRunId: "wr1",
      name: "test",
      idempotencyKey: "k1"
    });
    expect(store.insert).toHaveBeenCalledWith(
      TABLE_NAMES.WORKFLOW_STEP_EVENTS,
      expect.objectContaining({
        workflowRunId: "wr1",
        stepId: "__run__"
      })
    );
  });

  test("markRunStatus inserts with status", async () => {
    const store = createMockStore();
    const adapter = new WorkflowPersistenceAdapter(store);
    await adapter.markRunStatus("wr1", "CANCELLED");
    expect(store.insert).toHaveBeenCalledWith(
      TABLE_NAMES.WORKFLOW_STEP_EVENTS,
      expect.objectContaining({
        workflowRunId: "wr1",
        stepId: "__run_status__",
        state: "CANCELLED"
      })
    );
  });
});
