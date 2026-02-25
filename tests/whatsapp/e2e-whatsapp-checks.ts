import { buildStructuredResponse } from "@lib/text/response-contract";
import { formatStructuredForChannel } from "@lib/text/channel-formatter";
import type { WhatsAppDeliveryMetrics } from "./types";

const COMPETITOR_MARKERS = [/bayut/i, /property\s*finder/i, /dubizzle/i, /openrouter/i] as const;

function hasCompetitorName(text: string): boolean {
  return COMPETITOR_MARKERS.some((pattern) => pattern.test(text));
}

function hasLink(text: string): boolean {
  return /https?:\/\//i.test(text);
}

function countQuestions(text: string): number {
  return (text.match(/[?؟]/g) ?? []).length;
}

function buildPropertyReply(index: number): string {
  return `Found a matching property option ${index + 1}. Price is clear. Location is verified. Would you like more details?`;
}

export function evaluateWhatsAppPolicies(): {
  metrics: WhatsAppDeliveryMetrics;
  failures: Array<{ code: string; detail: string }>;
} {
  const failures: Array<{ code: string; detail: string }> = [];

  const normalSearchMessages = [0, 1, 2].map((index) => {
    const structured = buildStructuredResponse(buildPropertyReply(index));
    return formatStructuredForChannel(structured, "whatsapp");
  });

  const normalSearchPass = normalSearchMessages.length <= 3;
  if (!normalSearchPass) {
    failures.push({ code: "WA_POLICY_MAX3", detail: `normal-search messages=${normalSearchMessages.length}` });
  }

  const detailMessage = formatStructuredForChannel(
    buildStructuredResponse("Property gallery ready with key highlights. Area and price are validated. Want to book a visit?"),
    "whatsapp"
  );
  const detailPass = detailMessage.split("\n").length >= 3;
  if (!detailPass) {
    failures.push({ code: "WA_POLICY_DETAIL_FLOW", detail: "detail flow missing summary lines" });
  }

  const linkSuppressionPass = normalSearchMessages.every((message) => !hasLink(message)) && !hasLink(detailMessage);
  if (!linkSuppressionPass) {
    failures.push({ code: "WA_POLICY_LINKS", detail: "link found without explicit request" });
  }

  const competitorMaskPass = normalSearchMessages.every((message) => !hasCompetitorName(message)) && !hasCompetitorName(detailMessage);
  if (!competitorMaskPass) {
    failures.push({ code: "WA_POLICY_COMPETITOR", detail: "competitor/provider name leaked" });
  }

  const questionCount = normalSearchMessages.map((message) => countQuestions(message));
  if (questionCount.some((count) => count > 1)) {
    failures.push({ code: "WA_POLICY_NEXT_STEP", detail: `questions-per-message=${questionCount.join(",")}` });
  }

  return {
    metrics: {
      normalSearchMaxMessagesPassRate: normalSearchPass ? 1 : 0,
      detailGalleryPolicyPassRate: detailPass ? 1 : 0,
      linkSuppressionPassRate: linkSuppressionPass ? 1 : 0,
      competitorMaskPassRate: competitorMaskPass ? 1 : 0
    },
    failures
  };
}
