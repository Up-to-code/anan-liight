import { describe, expect, test } from "vitest";
import { buildStructuredResponse } from "../../src/lib/text/response-contract";
import { formatStructuredForChannel } from "../../src/lib/text/channel-formatter";

describe("text contract", () => {
  test("builds structured response and formats for whatsapp", () => {
    const structured = buildStructuredResponse("Here are options. Option A near downtown. Option B lower budget. Want me to compare?");
    expect(structured.answer.length).toBeGreaterThan(0);
    expect(structured.details.length).toBeGreaterThan(0);
    expect(structured.nextStep.endsWith("?")).toBe(true);

    const formatted = formatStructuredForChannel(structured, "whatsapp");
    expect(formatted.split("\n").length).toBeGreaterThan(2);
  });

  test("keeps exactly one question in output contract", () => {
    const structured = buildStructuredResponse("What do you need? Option one is ready? Option two is ready?");
    const formatted = formatStructuredForChannel(structured, "whatsapp");
    const questionLines = formatted
      .split("\n")
      .filter((line) => line.includes("?") || line.includes("؟"));

    expect(questionLines.length).toBe(1);
  });
});
