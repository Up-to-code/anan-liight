import type { RuntimeContainer } from "@modules/internal/runtime";
import { enforceCampaignPolicy } from "@lib/whatsapp/policy-guards";
import type { WaComplianceResult, WaMessageKind } from "@modules/whatsapp/types";
import { getConversationWindow } from "@modules/whatsapp/conversations/service";

export async function precheckCampaignSend(runtime: RuntimeContainer, input: {
  userId: string;
  phoneNumber: string;
  messageKind: WaMessageKind;
  templateId?: string;
}): Promise<WaComplianceResult> {
  const windowState = await getConversationWindow(runtime, {
    userId: input.userId,
    phoneNumber: input.phoneNumber
  });
  if (!runtime.env.FEATURE_LLIGHT_WA_TEMPLATE_ENFORCEMENT_ENABLED) {
    return { allowed: true, reason: "ok", windowState };
  }
  return enforceCampaignPolicy({
    windowState,
    messageKind: input.messageKind,
    ...(input.templateId ? { templateId: input.templateId } : {})
  });
}
