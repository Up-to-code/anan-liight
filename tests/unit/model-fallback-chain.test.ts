import { describe, expect, test } from "vitest";
import { ModelFallbackChain } from "@lib/openrouter/model-fallback-chain";
import type { CircuitStatePort } from "@lib/openrouter/circuit-state";
import type { ModelAttemptConfig } from "@lib/openrouter/types";

const mkAttempts = (): ModelAttemptConfig[] => [
  { model: "model-a", timeoutMs: 5000, maxTokens: 100, temperature: 0.2 },
  { model: "model-b", timeoutMs: 5000, maxTokens: 100, temperature: 0.2 }
];

describe("ModelFallbackChain", () => {
  test("getAvailableAttempts returns all when no circuits open", async () => {
    const chain = new ModelFallbackChain(mkAttempts(), 3, 60000);
    const result = await chain.getAvailableAttempts();
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.model)).toEqual(["model-a", "model-b"]);
  });

  test("recordFailure opens circuit after threshold", async () => {
    const chain = new ModelFallbackChain(mkAttempts(), 2, 60000);
    await chain.recordFailure("model-a");
    const after1 = await chain.getAvailableAttempts();
    expect(after1).toHaveLength(2);

    await chain.recordFailure("model-a");
    const after2 = await chain.getAvailableAttempts();
    expect(after2).toHaveLength(1);
    expect(after2[0]!.model).toBe("model-b");

    await chain.recordFailure("model-b");
    await chain.recordFailure("model-b");
    await expect(chain.getAvailableAttempts()).rejects.toMatchObject({
      code: "CIRCUIT_OPEN"
    });
  });

  test("recordSuccess resets circuit", async () => {
    const chain = new ModelFallbackChain(mkAttempts(), 2, 60000);
    await chain.recordFailure("model-a");
    await chain.recordFailure("model-a");
    await chain.recordFailure("model-b");
    await chain.recordFailure("model-b");
    await expect(chain.getAvailableAttempts()).rejects.toMatchObject({
      code: "CIRCUIT_OPEN"
    });

    await chain.recordSuccess("model-a");
    await chain.recordSuccess("model-b");
    const result = await chain.getAvailableAttempts();
    expect(result).toHaveLength(2);
  });

  test("with state port, hydrate loads persisted state", async () => {
    const saved: Array<{ model: string; failures: number; openedAt?: number }> = [];
    const port: CircuitStatePort = {
      load: async () => saved,
      save: async (_model, state) => {
        const entry: { model: string; failures: number; openedAt?: number } = {
          model: state.model,
          failures: state.failures
        };
        if (state.openedAt != null) entry.openedAt = state.openedAt;
        saved.push(entry);
      }
    };
    const chain = new ModelFallbackChain(mkAttempts(), 2, 60000, port);
    await chain.recordFailure("model-a");
    await chain.recordFailure("model-a");
    expect(saved.length).toBeGreaterThan(0);
  });
});
