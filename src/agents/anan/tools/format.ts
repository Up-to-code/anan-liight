import type { Channel } from "@shared/agent";

export function formatOfferText(input: {
  channel: Channel;
  title: string;
  price?: string;
  location?: string;
  summary?: string;
}): string {
  const lines = [input.title, input.price, input.location, input.summary].filter(Boolean);
  return input.channel === "whatsapp" ? lines.slice(0, 4).join("\n") : lines.join("\n");
}
