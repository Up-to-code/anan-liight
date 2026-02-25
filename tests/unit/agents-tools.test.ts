import { describe, expect, test } from "vitest";
import { searchProperties } from "@agents/anan/tools/property";
import { searchWebInfo } from "@agents/anan/tools/web";
import { formatOfferText } from "@agents/anan/tools/format";
import { storeMemoryFact } from "@agents/anan/tools/memory";

describe("property tool", () => {
  test("searchProperties returns ranked items for property intent", async () => {
    const result = await searchProperties({ query: "apartments in Riyadh" });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.propertyUrl.length).toBeGreaterThan(0);
  });

  test("searchProperties supports filters and exclusion", async () => {
    const first = await searchProperties({
      query: "Dubai apartment",
      location: "Dubai",
      budget: 2000000,
      bedrooms: 2
    });
    const excluded = first.items[0]?.propertyUrl;
    const second = await searchProperties({
      query: "Dubai apartment",
      location: "Dubai",
      bedrooms: 2,
      ...(excluded ? { excludeUrls: [excluded] } : {})
    });
    if (excluded) {
      expect(second.items.some((item) => item.propertyUrl === excluded)).toBe(false);
    }
  });
});

describe("web tool", () => {
  test("searchWebInfo returns ranked snippets", async () => {
    const result = await searchWebInfo({ query: "Saudi mortgage rates" });
    expect(result.snippets.length).toBeGreaterThan(0);
    expect(result.snippets[0]?.title.length).toBeGreaterThan(0);
  });

  test("searchWebInfo respects num parameter", async () => {
    const result = await searchWebInfo({ query: "market", num: 2 });
    expect(result.snippets.length).toBeLessThanOrEqual(2);
  });
});

describe("format tool", () => {
  test("formatOfferText limits to 4 lines for whatsapp", () => {
    const result = formatOfferText({
      channel: "whatsapp",
      title: "A",
      price: "B",
      location: "C",
      summary: "D"
    });
    expect(result.split("\n").length).toBeLessThanOrEqual(4);
    expect(result).toContain("A");
  });

  test("formatOfferText joins all lines for web", () => {
    const result = formatOfferText({
      channel: "web",
      title: "Title",
      price: "100",
      location: "Riyadh",
      summary: "Nice"
    });
    expect(result.split("\n").length).toBe(4);
  });

  test("formatOfferText handles missing optional fields", () => {
    const result = formatOfferText({
      channel: "whatsapp",
      title: "Title only"
    });
    expect(result).toBe("Title only");
  });
});

describe("memory tool", () => {
  test("storeMemoryFact resolves without throwing", async () => {
    await expect(storeMemoryFact({ key: "pref", value: "ar" })).resolves.toBeUndefined();
  });
});
