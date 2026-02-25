import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifyMetaWebhookSignature } from "@lib/whatsapp/signature";

describe("whatsapp signature", () => {
  test("rejects missing signature header", () => {
    expect(verifyMetaWebhookSignature("payload", undefined, "secret")).toBe(false);
  });

  test("rejects invalid header format without sha256=", () => {
    expect(verifyMetaWebhookSignature("payload", "invalid", "secret")).toBe(false);
  });

  test("rejects wrong signature", () => {
    expect(verifyMetaWebhookSignature("payload", "sha256=wrong", "secret")).toBe(false);
  });

  test("accepts valid sha256 HMAC", () => {
    const payload = '{"object":"whatsapp_business_account"}';
    const secret = "my-secret";
    const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
    expect(verifyMetaWebhookSignature(payload, expected, secret)).toBe(true);
  });
});
