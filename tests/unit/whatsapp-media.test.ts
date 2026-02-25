import { describe, expect, test } from "vitest";
import { parseInboundMedia } from "@lib/whatsapp/media";
import { mapWhatsAppError } from "@lib/whatsapp/error-map";

describe("parseInboundMedia", () => {
  test("returns image with id and caption", () => {
    const result = parseInboundMedia({
      image: { id: "img_1", caption: "Photo" }
    });
    expect(result.mediaType).toBe("image");
    expect(result.mediaId).toBe("img_1");
    expect(result.caption).toBe("Photo");
  });

  test("returns audio with id", () => {
    const result = parseInboundMedia({
      audio: { id: "aud_1" }
    });
    expect(result.mediaType).toBe("audio");
    expect(result.mediaId).toBe("aud_1");
  });

  test("returns video with id and caption", () => {
    const result = parseInboundMedia({
      video: { id: "vid_1", caption: "Clip" }
    });
    expect(result.mediaType).toBe("video");
    expect(result.mediaId).toBe("vid_1");
    expect(result.caption).toBe("Clip");
  });

  test("returns document with id", () => {
    const result = parseInboundMedia({
      document: { id: "doc_1" }
    });
    expect(result.mediaType).toBe("document");
    expect(result.mediaId).toBe("doc_1");
  });

  test("returns unknown for empty message", () => {
    const result = parseInboundMedia({});
    expect(result.mediaType).toBe("unknown");
  });
});

describe("mapWhatsAppError", () => {
  test("429 returns WA_RATE_LIMITED retryable", () => {
    const result = mapWhatsAppError(429, "limit");
    expect(result.code).toBe("WA_RATE_LIMITED");
    expect(result.retryable).toBe(true);
  });

  test("401 returns WA_AUTH not retryable", () => {
    const result = mapWhatsAppError(401, "");
    expect(result.code).toBe("WA_AUTH");
    expect(result.retryable).toBe(false);
  });

  test("403 returns WA_AUTH not retryable", () => {
    const result = mapWhatsAppError(403, "");
    expect(result.code).toBe("WA_AUTH");
  });

  test("5xx returns WA_PROVIDER_5XX retryable", () => {
    const result = mapWhatsAppError(500, "");
    expect(result.code).toBe("WA_PROVIDER_5XX");
    expect(result.retryable).toBe(true);
  });

  test("408 and 409 return retryable generic", () => {
    const r408 = mapWhatsAppError(408, "timeout");
    expect(r408.retryable).toBe(true);
    const r409 = mapWhatsAppError(409, "conflict");
    expect(r409.retryable).toBe(true);
  });
});
