import type { Channel } from "@shared/agent";
import { systemInstruction } from "@agents/anan/instructions/system";
import { routingInstruction } from "@agents/anan/instructions/routing";
import { memoryInstruction } from "@agents/anan/instructions/memory";
import { responseContractInstruction } from "@agents/anan/instructions/response-contract";
import { channelAdapterInstruction } from "@agents/anan/instructions/channels";

export const PROMPT_POLICY_VERSION = "v1.3";

export function buildAnanInstructions(channel: Channel): string {
  return [
    `PROMPT_POLICY_VERSION=${PROMPT_POLICY_VERSION}`,
    systemInstruction,
    routingInstruction,
    memoryInstruction,
    responseContractInstruction,
    channelAdapterInstruction(channel)
  ].join("\n\n");
}
