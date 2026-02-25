import { describe, expect, test } from "vitest";
import { computeConversationWindow, enforceCampaignPolicy } from "../../src/lib/whatsapp/policy-guards";

describe("whatsapp policy guards", () => {
  test("blocks free-form message when 24h window is closed", () => {
    const state = computeConversationWindow({
      phoneNumber: "966500000000",
      userId: "wa-user",
      lastInboundAt: Date.now() - 30 * 60 * 60 * 1000,
      now: Date.now()
    });

    const result = enforceCampaignPolicy({ windowState: state, messageKind: "text" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("window_closed_template_required");
  });

  test("allows template when 24h window is closed", () => {
    const state = computeConversationWindow({
      phoneNumber: "966500000000",
      userId: "wa-user",
      lastInboundAt: Date.now() - 30 * 60 * 60 * 1000,
      now: Date.now()
    });

    const result = enforceCampaignPolicy({
      windowState: state,
      messageKind: "template",
      templateId: "tpl_1"
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("ok");
  });

  test("computeConversationWindow window open when now <= lastInboundAt + 24h", () => {
    const lastInbound = Date.now() - 60 * 60 * 1000;
    const state = computeConversationWindow({
      phoneNumber: "966",
      userId: "u",
      lastInboundAt: lastInbound,
      now: lastInbound + 1000
    });
    expect(state.isOpen).toBe(true);
    expect(state.windowOpenUntil).toBe(lastInbound + 24 * 60 * 60 * 1000);
  });

  test("enforceCampaignPolicy allows text when window is open", () => {
    const lastInbound = Date.now() - 1000;
    const state = computeConversationWindow({
      phoneNumber: "966",
      userId: "u",
      lastInboundAt: lastInbound,
      now: lastInbound + 500
    });
    const result = enforceCampaignPolicy({ windowState: state, messageKind: "text" });
    expect(result.allowed).toBe(true);
  });

  test("enforceCampaignPolicy rejects template without templateId when window closed", () => {
    const state = computeConversationWindow({
      phoneNumber: "966",
      userId: "u",
      lastInboundAt: Date.now() - 30 * 60 * 60 * 1000,
      now: Date.now()
    });
    const result = enforceCampaignPolicy({
      windowState: state,
      messageKind: "template"
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("missing_template");
  });
});
