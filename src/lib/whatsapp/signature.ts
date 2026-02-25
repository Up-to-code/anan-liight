import { createHmac } from "node:crypto";

export function verifyMetaWebhookSignature(payload: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  return expected === signatureHeader;
}
