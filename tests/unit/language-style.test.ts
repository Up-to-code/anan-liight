import { describe, expect, test } from "vitest";
import { detectLanguage, defaultNextStep } from "@lib/text/language-style";

describe("language-style", () => {
  describe("detectLanguage", () => {
    test("returns ar for Arabic script", () => {
      expect(detectLanguage("مرحبا")).toBe("ar");
      expect(detectLanguage("شقة في الرياض")).toBe("ar");
    });

    test("returns en for Latin-only text", () => {
      expect(detectLanguage("Hello")).toBe("en");
      expect(detectLanguage(" apartments in Riyadh")).toBe("en");
    });
  });

  describe("defaultNextStep", () => {
    test("returns Arabic question for ar", () => {
      expect(defaultNextStep("ar")).toBe("هل تريد أن أكمل بالخطوة التالية؟");
    });

    test("returns English question for en", () => {
      expect(defaultNextStep("en")).toBe("Would you like me to continue with the next step?");
    });
  });
});
