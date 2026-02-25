import type { Channel } from "@shared/agent";

export function channelAdapterInstruction(channel: Channel): string {
  if (channel === "whatsapp") {
    return "WhatsApp mode: plain compact bullets, no markdown tables, no noisy multi-message output.";
  }
  if (channel === "web") {
    return "Web mode: concise structured response with short bullets and clear next step.";
  }
  return "App mode: concise response with direct action guidance.";
}
