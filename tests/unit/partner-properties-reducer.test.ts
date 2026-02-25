import { describe, expect, test, vi } from "vitest";
import { createPartnerProperty } from "@modules/reducers/partner-properties-reducer";
import * as repos from "@modules/internal/repositories";

vi.mock("@modules/internal/repositories", () => ({
  addPartnerProperty: vi.fn().mockResolvedValue("prop-123")
}));

const createMockRuntime = () =>
  ({
    store: {}
  }) as Parameters<typeof createPartnerProperty>[0];

describe("createPartnerProperty", () => {
  test("throws for missing title", async () => {
    const runtime = createMockRuntime();
    await expect(
      createPartnerProperty(runtime, {
        partnerId: "p1",
        title: "",
        address: "addr",
        description: "desc",
        price: 100,
        beds: 2,
        baths: 1
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("throws for missing address", async () => {
    const runtime = createMockRuntime();
    await expect(
      createPartnerProperty(runtime, {
        partnerId: "p1",
        title: "t",
        address: "",
        description: "d",
        price: 100,
        beds: 2,
        baths: 1
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("throws for invalid price", async () => {
    const runtime = createMockRuntime();
    await expect(
      createPartnerProperty(runtime, {
        partnerId: "p1",
        title: "t",
        address: "a",
        description: "d",
        price: 0,
        beds: 2,
        baths: 1
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("throws for invalid beds", async () => {
    const runtime = createMockRuntime();
    await expect(
      createPartnerProperty(runtime, {
        partnerId: "p1",
        title: "t",
        address: "a",
        description: "d",
        price: 100,
        beds: 0,
        baths: 1
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("returns created id on valid input", async () => {
    const runtime = createMockRuntime();
    const result = await createPartnerProperty(runtime, {
      partnerId: "p1",
      title: "Villa",
      address: "Riyadh",
      description: "Nice",
      price: 500000,
      beds: 3,
      baths: 2
    });
    expect(result).toEqual({ id: "prop-123", status: "created" });
    expect(repos.addPartnerProperty).toHaveBeenCalled();
  });
});
