import { describe, expect, test } from "vitest";
import { formatStructuredForChannel } from "../../src/lib/text/channel-formatter";

describe("channel-formatter", () => {
  test("formats for whatsapp with limited details", () => {
    const result = formatStructuredForChannel(
      {
        answer: "Here is the answer",
        details: ["Detail 1", "Detail 2"],
        nextStep: "Ask for more"
      },
      "whatsapp"
    );
    expect(result).toContain("Here is the answer");
    expect(result).toContain("Detail 1");
    expect(result).toContain("Detail 2");
    expect(result).toContain("Ask for more");
    expect(result.split("\n").length).toBeLessThanOrEqual(5);
  });

  test("formats for web with more details", () => {
    const result = formatStructuredForChannel(
      {
        answer: "Answer",
        details: ["A", "B", "C", "D"],
        nextStep: "Next"
      },
      "web"
    );
    expect(result).toContain("Answer");
    expect(result).toContain("Next: Next");
  });

  test("dedupes duplicate detail lines", () => {
    const result = formatStructuredForChannel(
      {
        answer: "A",
        details: ["Same", "same", "SAME"],
        nextStep: "N"
      },
      "whatsapp"
    );
    const lines = result.split("\n");
    const detailLines = lines.filter((l) => l.startsWith("- "));
    expect(detailLines.length).toBe(1);
  });

  test("sanitizes competitor names and links in user-facing output", () => {
    const result = formatStructuredForChannel(
      {
        answer: "Found on Bayut https://example.com/listing",
        details: ["Property Finder option available", "openrouter source"],
        nextStep: "Would you like details?"
      },
      "whatsapp"
    );
    expect(result.toLowerCase()).not.toContain("bayut");
    expect(result.toLowerCase()).not.toContain("property finder");
    expect(result.toLowerCase()).not.toContain("openrouter");
    expect(result).not.toContain("http://");
    expect(result).not.toContain("https://");
  });
});
