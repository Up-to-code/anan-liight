import { describe, expect, test } from "vitest";
import { TaskQueue } from "../../src/lib/queue/task-queue";

describe("TaskQueue", () => {
  test("throws when queue is full", () => {
    const queue = new TaskQueue("q", 1);
    queue.enqueue({ taskId: "1", priority: "NORMAL", enqueuedAt: Date.now(), execute: async () => {} });

    expect(() =>
      queue.enqueue({ taskId: "2", priority: "NORMAL", enqueuedAt: Date.now(), execute: async () => {} })
    ).toThrowError();
  });
});
