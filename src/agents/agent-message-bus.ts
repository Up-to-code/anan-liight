import { randomUUID } from "node:crypto";
import type { AgentMessageBusPort } from "@agents/types";
import type { AgentMessage } from "@shared/agent";

/**
 * Durable pub/sub abstraction over SpacetimeDB-backed message rows.
 */
export class AgentMessageBus {
  public constructor(private readonly port: AgentMessageBusPort) {}

  /**
   * Publishes agent-to-agent message.
   * @param input Message details
   */
  public async publish(input: Omit<AgentMessage, "messageId" | "createdAt">): Promise<void> {
    await this.port.publish({
      ...input,
      messageId: randomUUID(),
      createdAt: Date.now()
    });
  }

  /**
   * Pulls pending messages for specific agent.
   * @param agentId Agent identifier
   * @param limit Maximum batch size
   * @returns Messages
   */
  public async consume(agentId: string, limit: number): Promise<AgentMessage[]> {
    return this.port.consume(agentId, limit);
  }
}
