export type ParsedMedia = {
  mediaType: "image" | "audio" | "video" | "document" | "unknown";
  mediaId?: string | undefined;
  caption?: string | undefined;
};

export function parseInboundMedia(message: Record<string, unknown>): ParsedMedia {
  if (message["image"] && typeof message["image"] === "object") {
    const image = message["image"] as { id?: string; caption?: string };
    return {
      mediaType: "image",
      ...(image.id ? { mediaId: image.id } : {}),
      ...(image.caption ? { caption: image.caption } : {})
    };
  }
  if (message["audio"] && typeof message["audio"] === "object") {
    const audio = message["audio"] as { id?: string };
    return { mediaType: "audio", ...(audio.id ? { mediaId: audio.id } : {}) };
  }
  if (message["video"] && typeof message["video"] === "object") {
    const video = message["video"] as { id?: string; caption?: string };
    return {
      mediaType: "video",
      ...(video.id ? { mediaId: video.id } : {}),
      ...(video.caption ? { caption: video.caption } : {})
    };
  }
  if (message["document"] && typeof message["document"] === "object") {
    const doc = message["document"] as { id?: string; caption?: string };
    return {
      mediaType: "document",
      ...(doc.id ? { mediaId: doc.id } : {}),
      ...(doc.caption ? { caption: doc.caption } : {})
    };
  }
  return { mediaType: "unknown" };
}
