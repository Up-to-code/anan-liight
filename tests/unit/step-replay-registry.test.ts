import { describe, expect, test, vi } from "vitest";
import { StepReplayRegistry } from "@workflows/step-replay-registry";

describe("StepReplayRegistry", () => {
  test("resolve returns null for unregistered key", () => {
    const registry = new StepReplayRegistry();
    expect(registry.resolve("unknown")).toBeNull();
  });

  test("resolve returns registered action", async () => {
    const registry = new StepReplayRegistry();
    const fn = vi.fn().mockResolvedValue(undefined);
    registry.register("key1", fn);
    const action = registry.resolve("key1");
    expect(action).not.toBeNull();
    await action!();
    expect(fn).toHaveBeenCalled();
  });

  test("register overwrites existing", async () => {
    const registry = new StepReplayRegistry();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    registry.register("k", fn1);
    registry.register("k", fn2);
    const action = registry.resolve("k");
    await action!();
    expect(fn2).toHaveBeenCalled();
    expect(fn1).not.toHaveBeenCalled();
  });
});
