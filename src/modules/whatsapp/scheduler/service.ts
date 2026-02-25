import type { RuntimeContainer } from "@modules/internal/runtime";
import { executeCampaign } from "@modules/whatsapp/campaigns/service";
import { TABLE_NAMES } from "@shared/constants";

interface CampaignRow {
  campaignId: string;
  name: string;
  templateId?: string;
  messageKind: "text" | "image" | "document" | "template" | "reaction";
  payloadJson?: string;
  audienceJson?: string;
  status: "draft" | "scheduled" | "running" | "paused" | "cancelled" | "completed";
  createdAt: number;
  updatedAt: number;
  scheduledAt?: number;
}

export async function runCampaignSchedulerTick(runtime: RuntimeContainer): Promise<void> {
  if (!runtime.env.FEATURE_LLIGHT_WA_PLATFORM_ENABLED || !runtime.env.FEATURE_LLIGHT_WA_CAMPAIGNS_ENABLED) {
    return;
  }

  await runtime.scheduler.runDueJobs("wa-campaign-dispatch", 50, async (job) => {
    const payload = JSON.parse(job.payloadJson) as { campaignId: string };
    const campaignRows = await runtime.store.queryMany<CampaignRow>(
      TABLE_NAMES.WA_CAMPAIGNS,
      [{ field: "campaignId", op: "eq", value: payload.campaignId }],
      1
    );
    const row = campaignRows[0];
    if (!row) return;

    const campaign = {
      campaignId: row.campaignId,
      name: row.name,
      templateId: row.templateId,
      messageKind: row.messageKind,
      payload: JSON.parse(row.payloadJson ?? "{}") as Record<string, string>,
      audience: JSON.parse(row.audienceJson ?? "[]") as string[],
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      scheduledAt: row.scheduledAt
    };

    const recipients = campaign.audience.map((phoneNumber) => ({ userId: `wa-${phoneNumber}`, phoneNumber }));
    await executeCampaign(runtime, { campaign, recipients, maxMessages: runtime.env.WHATSAPP_MAX_BATCH_SEND });
  });
}
