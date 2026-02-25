import { describe, expect, test } from "vitest";
import type { AgentScheduler } from "../../src/agents/agent-scheduler";
import { StepRunner } from "../../src/workflows/step-runner";
import { StepReplayRegistry } from "../../src/workflows/step-replay-registry";

class MockPersistence {
  public attempts: Array<Record<string, unknown>> = [];
  public async createRun(): Promise<void> {}
  public async markRunStatus(): Promise<void> {}
  public async upsertStep(): Promise<void> {}
  public async logStepAttempt(input: Record<string, unknown>): Promise<void> {
    this.attempts.push(input);
  }
}

class MockScheduler {
  public jobs: Array<{ queueName: string; payload: Record<string, string>; runAt: number }> = [];
  public async schedule(queueName: string, payload: Record<string, string>, runAt: number): Promise<void> {
    this.jobs.push({ queueName, payload, runAt });
  }
  public async runDueJobs(): Promise<void> {}
}

class MockDeadLetter {
  public writes = 0;
  public async write(): Promise<void> {
    this.writes += 1;
  }
}

describe("step runner replay rounds", () => {
  test("schedules replay rounds after immediate retries fail", async () => {
    const persistence = new MockPersistence();
    const scheduler = new MockScheduler() as unknown as AgentScheduler;
    const deadLetter = new MockDeadLetter();
    const runner = new StepRunner(persistence, {
      immediateRetries: 3,
      scheduledRetries: 5,
      scheduler,
      replayQueueName: "workflow-step-replay",
      replayRegistry: new StepReplayRegistry(),
      deadLetter
    });

    await expect(runner.run("wf-1", {
      stepId: "step-a",
      timeoutMs: 20,
      maxAttempts: 3,
      execute: async () => {
        throw new Error("boom");
      }
    })).rejects.toBeTruthy();

    expect((scheduler as unknown as MockScheduler).jobs.length).toBe(5);
    expect(deadLetter.writes).toBe(1);
  });
});
