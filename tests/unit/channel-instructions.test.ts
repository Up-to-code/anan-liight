import { describe, expect, test } from "vitest";
import { channelAdapterInstruction } from "@agents/anan/instructions/channels";
import { resolveMemoryContext } from "@agents/anan/memory/service";

describe("channelAdapterInstruction", () => {
  test("returns whatsapp instruction for whatsapp channel", () => {
    const result = channelAdapterInstruction("whatsapp");
    expect(result).toContain("WhatsApp");
    expect(result).toContain("plain compact");
  });

  test("returns web instruction for web channel", () => {
    const result = channelAdapterInstruction("web");
    expect(result).toContain("Web");
    expect(result).toContain("structured");
  });

  test("returns app instruction for app channel", () => {
    const result = channelAdapterInstruction("app");
    expect(result).toContain("App");
    expect(result).toContain("direct action");
  });
});

describe("resolveMemoryContext", () => {
  test("returns user:userId", async () => {
    const result = await resolveMemoryContext("user-123");
    expect(result).toBe("user:user-123");
  });
});
