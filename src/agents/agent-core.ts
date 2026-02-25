import { randomUUID } from "node:crypto";
import { AppError } from "@lib/errors/app-error";
import { withLogContext } from "@lib/observability/logger";
import type { AgentPersistencePort } from "@agents/types";
import type { AgentSoulRecord, AgentState } from "@shared/agent";

/**
 * Base class for all agents with durable soul and lifecycle transitions.
 */
export abstract class AgentCore {
  protected readonly soul: AgentSoulRecord;

  protected constructor(
    protected readonly persistence: AgentPersistencePort,
    agentType: string,
    agentId = randomUUID()
  ) {
    const now = Date.now();
    this.soul = {
      agentId,
      agentType,
      status: "IDLE",
      memorySnapshot: {},
      lastHeartbeat: now,
      version: 1,
      updatedAt: now
    };
  }

  /**
   * Boots agent and persists initial soul state.
   */
  public async boot(): Promise<void> {
    await this.transition("RUNNING", "onBoot");
    await this.onBoot();
  }

  /**
   * Sleeps agent and persists state transition.
   */
  public async sleep(): Promise<void> {
    await this.transition("SLEEPING", "onSleep");
    await this.onSleep();
  }

  /**
   * Wakes agent and persists state transition.
   */
  public async wake(): Promise<void> {
    await this.transition("RUNNING", "onWake");
    await this.onWake();
  }

  /**
   * Marks failure with explicit reason.
   * @param reason Failure reason
   */
  public async fail(reason: string): Promise<void> {
    await this.transition("FAILED", `onFail:${reason}`);
    await this.onFail(reason);
  }

  /**
   * Terminates agent lifecycle permanently.
   */
  public async terminate(): Promise<void> {
    await this.transition("TERMINATED", "onTerminate");
    await this.onTerminate();
  }

  protected abstract onBoot(): Promise<void>;
  protected abstract onSleep(): Promise<void>;
  protected abstract onWake(): Promise<void>;
  protected abstract onFail(reason: string): Promise<void>;
  protected abstract onTerminate(): Promise<void>;

  protected remember(key: string, value: string): void {
    this.soul.memorySnapshot[key] = value;
  }

  private async transition(next: AgentState, reason: string): Promise<void> {
    const previous = this.soul.status;
    this.validateTransition(previous, next);

    this.soul.status = next;
    this.soul.version += 1;
    this.soul.updatedAt = Date.now();
    this.soul.lastHeartbeat = this.soul.updatedAt;

    await this.persistence.upsertSoul(this.soul);
    await this.persistence.logLifecycleEvent({
      agentId: this.soul.agentId,
      fromState: previous,
      toState: next,
      reason,
      timestamp: this.soul.updatedAt
    });

    withLogContext({ traceId: randomUUID(), agentId: this.soul.agentId }).info({
      event: "agent_state_transition",
      fromState: previous,
      toState: next,
      reason
    });
  }

  private validateTransition(from: AgentState, to: AgentState): void {
    const valid: Record<AgentState, AgentState[]> = {
      IDLE: ["RUNNING", "TERMINATED"],
      RUNNING: ["WAITING", "SLEEPING", "FAILED", "TERMINATED"],
      WAITING: ["RUNNING", "SLEEPING", "FAILED", "TERMINATED"],
      SLEEPING: ["RUNNING", "TERMINATED"],
      FAILED: ["RUNNING", "TERMINATED"],
      TERMINATED: []
    };

    const allowed = valid[from] ?? [];
    if (!allowed.includes(to)) {
      throw new AppError({
        code: "CONFLICT",
        message: `Invalid transition ${from} -> ${to}`,
        payload: { reason: `${from}->${to}` },
        retryable: false
      });
    }
  }
}
