import type { Channel } from "@shared/agent";
import { ensureStructuredResponse, type StructuredTextResponse } from "@lib/text/response-contract";

const PROVIDER_PATTERNS = [
  /\bopenrouter\b/gi,
  /\bbayut\b/gi,
  /\bproperty\s*finder\b/gi,
  /\bdubizzle\b/gi
] as const;

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }

  return result;
}

function sanitizeUserFacingText(text: string): string {
  let sanitized = text.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  for (const pattern of PROVIDER_PATTERNS) {
    sanitized = sanitized.replace(pattern, "").replace(/\s+/g, " ").trim();
  }
  return sanitized;
}

/**
 * Formats structured response for a specific channel.
 * @param input Structured response
 * @param channel Target channel
 * @returns Formatted text
 */
export function formatStructuredForChannel(input: StructuredTextResponse, channel: Channel): string {
  const normalized = ensureStructuredResponse(input);
  const details = dedupeLines(normalized.details).slice(0, channel === "whatsapp" ? 3 : 4);
  const detailLines = details.map((item) => `- ${sanitizeUserFacingText(item)}`);
  const answer = sanitizeUserFacingText(normalized.answer);
  const nextStep = sanitizeUserFacingText(normalized.nextStep);

  if (channel === "whatsapp") {
    return [answer, ...detailLines, nextStep].join("\n");
  }

  return [answer, ...detailLines, `Next: ${nextStep}`].join("\n");
}
