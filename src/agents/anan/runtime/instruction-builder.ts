import type { Channel } from "@shared/agent";
import { buildAnanInstructions } from "@agents/anan/instructions";

export function buildInstructionEnvelope(input: {
  channel: Channel;
  memoryContext?: string;
}): string {
  const memoryBlock = input.memoryContext
    ? `MEMORY_CONTEXT:\n${input.memoryContext}\n\nDo not re-ask remembered fields.`
    : "";

  return [buildAnanInstructions(input.channel), memoryBlock].filter(Boolean).join("\n\n");
}
