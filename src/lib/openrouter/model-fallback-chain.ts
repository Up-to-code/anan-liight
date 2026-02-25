import { AppError } from "@lib/errors/app-error";
import type { ModelAttemptConfig } from "@lib/openrouter/types";
import type { CircuitStatePort } from "@lib/openrouter/circuit-state";

export interface CircuitBreakerState {
  failures: number;
  openedAt?: number | undefined;
}

export class ModelFallbackChain {
  private readonly state = new Map<string, CircuitBreakerState>();

  public constructor(
    private readonly attempts: ModelAttemptConfig[],
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly statePort?: CircuitStatePort
  ) {}

  private hydrated = false;

  public async hydrate(): Promise<void> {
    if (!this.statePort || this.hydrated) return;
    const rows = await this.statePort.load();
    for (const row of rows) {
      this.state.set(row.model, { failures: row.failures, ...(row.openedAt != null ? { openedAt: row.openedAt } : {}) });
    }
    this.hydrated = true;
  }

  /**
   * Returns currently available model attempts after circuit checks.
   * @returns Ordered available attempts
   * @throws AppError when all circuits are open
   */
  public async getAvailableAttempts(): Promise<ModelAttemptConfig[]> {
    await this.hydrate();
    const now = Date.now();
    const available = this.attempts.filter((item) => {
      const current = this.state.get(item.model);
      if (!current?.openedAt) return true;
      return now - current.openedAt >= this.cooldownMs;
    });

    if (available.length === 0) {
      throw new AppError({
        code: "CIRCUIT_OPEN",
        message: "All model circuits are currently open",
        payload: { circuit: "openrouter-chain", retryAt: now + this.cooldownMs },
        retryable: true
      });
    }

    return available;
  }

  /**
   * Records failure for model and opens circuit if threshold is reached.
   * @param model Model name
   */
  public async recordFailure(model: string): Promise<void> {
    await this.hydrate();
    const current = this.state.get(model) ?? { failures: 0 };
    const failures = current.failures + 1;
    if (failures >= this.failureThreshold) {
      const next = { failures, openedAt: Date.now() };
      this.state.set(model, next);
      await this.statePort?.save(model, { model, failures: next.failures, ...(next.openedAt != null ? { openedAt: next.openedAt } : {}) });
      return;
    }

    const next = current.openedAt ? { failures, openedAt: current.openedAt } : { failures };
    this.state.set(model, next);
    await this.statePort?.save(model, { model, failures: next.failures, ...(next.openedAt != null ? { openedAt: next.openedAt } : {}) });
  }

  /**
   * Resets circuit state on successful model response.
   * @param model Model name
   */
  public async recordSuccess(model: string): Promise<void> {
    await this.hydrate();
    this.state.set(model, { failures: 0 });
    await this.statePort?.save(model, { model, failures: 0 });
  }
}
