import { describe, expect, test } from "vitest";
import { buildInstructionEnvelope } from "@agents/anan/runtime/instruction-builder";
import { buildAnanInstructions } from "@agents/anan/instructions";

describe("instruction builder", () => {
  describe("buildInstructionEnvelope", () => {
    test("includes memory block when memoryContext present", () => {
      const result = buildInstructionEnvelope({
        channel: "web",
        memoryContext: "user prefers Arabic"
      });
      expect(result).toContain("MEMORY_CONTEXT:");
      expect(result).toContain("user prefers Arabic");
      expect(result).toContain("Do not re-ask remembered fields.");
    });

    test("omits memory block when memoryContext absent", () => {
      const result = buildInstructionEnvelope({ channel: "web" });
      expect(result).not.toContain("MEMORY_CONTEXT:");
    });
  });

  describe("buildAnanInstructions", () => {
    test("includes PROMPT_POLICY_VERSION", () => {
      const result = buildAnanInstructions("web");
      expect(result).toContain("PROMPT_POLICY_VERSION=v1.3");
    });

    test("includes all instruction blocks", () => {
      const result = buildAnanInstructions("whatsapp");
      expect(result).toContain("ANAN");
      expect(result).toContain("Property listing");
      expect(result).toContain("WhatsApp mode");
    });
  });
});
