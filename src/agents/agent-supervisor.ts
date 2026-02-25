import { randomUUID } from "node:crypto";
import { withLogContext } from "@lib/observability/logger";
import type { AgentCore } from "@agents/agent-core";

export type SupervisorDecision = "restart" | "escalate" | "terminate";

/**
 * Supervises agent failures and applies policy-based recovery decisions.
 */
export class AgentSupervisor {
  public constructor(private readonly maxRestarts: number) {}

  /**
   * Handles failure with explicit decision.
   * @param agent Agent instance
   * @param failureCount Number of recent failures
   * @param reason Failure reason
   */
  public async handleFailure(agent: AgentCore, failureCount: number, reason: string): Promise<SupervisorDecision> {
    const decision = this.decide(failureCount);
    withLogContext({ traceId: randomUUID() }).warn({ event: "agent_supervisor_decision", decision, reason });

    if (decision === "restart") {
      await agent.fail(reason);
      await agent.wake();
    }

    if (decision === "terminate") {
      await agent.terminate();
    }

    return decision;
  }

  private decide(failureCount: number): SupervisorDecision {
    if (failureCount < this.maxRestarts) return "restart";
    if (failureCount === this.maxRestarts) return "escalate";
    return "terminate";
  }
}
