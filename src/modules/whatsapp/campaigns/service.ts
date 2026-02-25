import { randomUUID } from "node:crypto";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { WhatsAppCloudClient } from "@lib/whatsapp/cloud-client";
import { AdaptiveThrottle } from "@lib/whatsapp/rate-control";
import type { WaCampaign, WaSendRequest } from "@modules/whatsapp/types";
import { TABLE_NAMES } from "@shared/constants";
import { precheckCampaignSend } from "@modules/whatsapp/compliance/service";
import { logDeliveryAttempt } from "@modules/whatsapp/delivery/service";
import { incrementCounter, observeDuration } from "@lib/observability/metrics";

export async function createCampaign(runtime: RuntimeContainer, input: {
  name: string;
  messageKind: WaCampaign["messageKind"];
  payload: Record<string, string>;
  audience: string[];
  templateId?: string;
  scheduledAt?: number;
}): Promise<WaCampaign> {
  const now = Date.now();
  const campaign: WaCampaign = {
    campaignId: randomUUID(),
    name: input.name,
    ...(input.templateId ? { templateId: input.templateId } : {}),
    messageKind: input.messageKind,
    payload: input.payload,
    audience: input.audience,
    ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    status: input.scheduledAt ? "scheduled" : "draft",
    createdAt: now,
    updatedAt: now
  };

  await runtime.store.insert(TABLE_NAMES.WA_CAMPAIGNS, {
    id: randomUUID(),
    ...campaign,
    payloadJson: JSON.stringify(campaign.payload),
    audienceJson: JSON.stringify(campaign.audience),
    version: 1
  });

  return campaign;
}

export async function scheduleCampaign(runtime: RuntimeContainer, campaignId: string, runAt: number): Promise<void> {
  await runtime.scheduler.schedule("wa-campaign-dispatch", { campaignId, runAt: String(runAt) }, runAt);
}

export async function executeCampaign(runtime: RuntimeContainer, input: {
  campaign: WaCampaign;
  recipients: Array<{ userId: string; phoneNumber: string }>;
  maxMessages?: number;
}): Promise<{ sent: number; failed: number }> {
  const startedAt = Date.now();
  const throttle = new AdaptiveThrottle();
  const limit = Math.min(input.maxMessages ?? 100, 100);
  const client = new WhatsAppCloudClient(runtime.env.WHATSAPP_PHONE_NUMBER_ID, runtime.env.WHATSAPP_ACCESS_TOKEN);
  let sent = 0;
  let failed = 0;

  for (const recipient of input.recipients.slice(0, limit)) {
    const compliance = await precheckCampaignSend(runtime, {
      userId: recipient.userId,
      phoneNumber: recipient.phoneNumber,
      messageKind: input.campaign.messageKind,
      ...(input.campaign.templateId ? { templateId: input.campaign.templateId } : {})
    });

    if (!compliance.allowed) {
      failed += 1;
      incrementCounter("wa.campaign.blocked", { reason: compliance.reason });
      continue;
    }

    if (runtime.env.WHATSAPP_ADAPTIVE_QUEUE_ENABLED) {
      await throttle.waitTurn();
    }
    const request: WaSendRequest = {
      to: recipient.phoneNumber,
      type: input.campaign.messageKind,
      ...(input.campaign.payload["body"] ? { body: input.campaign.payload["body"] } : {}),
      ...(input.campaign.payload["mediaUrl"] ? { mediaUrl: input.campaign.payload["mediaUrl"] } : {}),
      ...(input.campaign.payload["templateName"] ? { templateName: input.campaign.payload["templateName"] } : {}),
      ...(input.campaign.payload["templateParams"] ? { templateParams: input.campaign.payload["templateParams"].split(",") } : {}),
      idempotencyKey: `${input.campaign.campaignId}:${recipient.phoneNumber}`
    };

    const result = await client.send(request);
    await logDeliveryAttempt(runtime, {
      campaignId: input.campaign.campaignId,
      userId: recipient.userId,
      phoneNumber: recipient.phoneNumber,
      requestType: request.type,
      result,
      ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {})
    });

    if (result.success) {
      sent += 1;
      if (runtime.env.WHATSAPP_ADAPTIVE_QUEUE_ENABLED) {
        throttle.onSuccess(result.latencyMs);
      }
      incrementCounter("wa.campaign.sent", { mode: "adaptive" });
    } else {
      failed += 1;
      if (runtime.env.WHATSAPP_ADAPTIVE_QUEUE_ENABLED) {
        throttle.onBackpressure();
      }
      incrementCounter("wa.campaign.failed", { code: result.errorCode ?? "unknown" });
    }
  }

  observeDuration("wa.campaign.total_latency_ms", Date.now() - startedAt, { status: failed > 0 ? "partial" : "ok" });
  return { sent, failed };
}

export async function updateCampaignStatus(runtime: RuntimeContainer, campaignId: string, status: WaCampaign["status"]): Promise<void> {
  await runtime.store.insert(TABLE_NAMES.WA_POLICY_AUDIT_LOG, {
    id: randomUUID(),
    auditId: randomUUID(),
    event: "campaign_status_update",
    payloadJson: JSON.stringify({ campaignId, status }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  });
}
