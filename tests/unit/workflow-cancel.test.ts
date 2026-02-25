import { describe, expect, test, vi } from "vitest";
import { WorkflowCancel } from "@workflows/workflow-cancel";
import type { WorkflowPersistencePort } from "@workflows/types";

describe("WorkflowCancel", () => {
  test("compensate runs steps in reverse order", async () => {
    const order: string[] = [];
    const persistence: WorkflowPersistencePort = {
      createRun: vi.fn(),
      markRunStatus: vi.fn(),
      upsertStep: vi.fn(),
      logStepAttempt: vi.fn()
    };
    const cancel = new WorkflowCancel(persistence);
    const steps = [
      {
        stepId: "s1",
        timeoutMs: 1000,
        maxAttempts: 1,
        execute: vi.fn(),
        compensate: vi.fn(async () => {
          order.push("s1");
        })
      },
      {
        stepId: "s2",
        timeoutMs: 1000,
        maxAttempts: 1,
        execute: vi.fn(),
        compensate: vi.fn(async () => {
          order.push("s2");
        })
      }
    ];
    await cancel.compensate("wr1", steps);
    expect(order).toEqual(["s2", "s1"]);
    expect(persistence.markRunStatus).toHaveBeenCalledWith("wr1", "CANCELLED");
  });

  test("compensate skips steps without compensate", async () => {
    const persistence: WorkflowPersistencePort = {
      createRun: vi.fn(),
      markRunStatus: vi.fn(),
      upsertStep: vi.fn(),
      logStepAttempt: vi.fn()
    };
    const cancel = new WorkflowCancel(persistence);
    const steps = [
      {
        stepId: "s1",
        timeoutMs: 1000,
        maxAttempts: 1,
        execute: vi.fn()
      }
    ];
    await cancel.compensate("wr1", steps);
    expect(persistence.markRunStatus).toHaveBeenCalledWith("wr1", "CANCELLED");
  });
});
