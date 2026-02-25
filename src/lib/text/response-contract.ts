import { z } from "zod";
import { defaultNextStep, detectLanguage } from "@lib/text/language-style";

export const structuredTextSchema = z.object({
  answer: z.string().min(1),
  details: z.array(z.string().min(1)).min(1).max(4),
  nextStep: z.string().min(1)
});

export type StructuredTextResponse = z.infer<typeof structuredTextSchema>;

function toSentences(raw: string): string[] {
  return raw
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!؟?])\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function normalizeQuestion(question: string, language: "ar" | "en"): string {
  const mark = language === "ar" ? "؟" : "?";
  const cleaned = question.replace(/[?؟]+/g, "").trim();
  if (cleaned.length === 0) return defaultNextStep(language);
  if (cleaned.endsWith("?") || cleaned.endsWith("؟")) return cleaned;
  return `${cleaned}${mark}`;
}

function sanitizeStatement(input: string, language: "ar" | "en"): string {
  const cleaned = input.replace(/[?؟]+/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length > 0) return cleaned;
  return language === "ar" ? "تم تجهيز الرد." : "Response prepared.";
}

function isQuestion(input: string): boolean {
  return input.includes("?") || input.includes("؟");
}

function isCloseVariant(candidate: string, answer: string): boolean {
  return candidate.toLowerCase() === answer.toLowerCase();
}

function fallbackDetails(answer: string, language: "ar" | "en"): string[] {
  const defaults = language === "ar"
    ? ["هذه أهم النقاط المتاحة الآن.", "أقدر أتابع لك بالخطوة الجاية مباشرة."]
    : ["These are the key points available now.", "I can continue with the next step immediately."];
  return [answer, ...defaults].slice(0, 3);
}

function pickAnswer(sentences: string[], language: "ar" | "en"): string {
  const candidate = sentences.find((item) => !isQuestion(item)) ?? sentences[0];
  return sanitizeStatement(candidate ?? "", language);
}

function pickDetails(sentences: string[], answer: string, language: "ar" | "en"): string[] {
  const statementPool = sentences
    .filter((item) => !isQuestion(item))
    .map((item) => sanitizeStatement(item, language))
    .filter((item) => item.length > 0 && !isCloseVariant(item, answer));

  if (statementPool.length > 0) {
    return statementPool.slice(0, 4);
  }
  return fallbackDetails(answer, language);
}

function pickNextStep(sentences: string[], language: "ar" | "en"): string {
  const questionCandidate = sentences.find((item) => isQuestion(item));
  return normalizeQuestion(questionCandidate ?? defaultNextStep(language), language);
}

function enforceContract(raw: StructuredTextResponse): StructuredTextResponse {
  const language = detectLanguage(`${raw.answer}\n${raw.details.join("\n")}\n${raw.nextStep}`);
  const answer = sanitizeStatement(raw.answer, language);
  const details = raw.details
    .map((item) => sanitizeStatement(item, language))
    .filter((item) => item.length > 0 && !isCloseVariant(item, answer))
    .slice(0, 4);
  const nextStep = normalizeQuestion(raw.nextStep, language);

  return {
    answer,
    details: details.length > 0 ? details : fallbackDetails(answer, language),
    nextStep
  };
}

/**
 * Validates and repairs a structured response payload.
 * @param input Structured response candidate
 * @returns Repaired structured response
 */
export function ensureStructuredResponse(input: StructuredTextResponse): StructuredTextResponse {
  const parsed = structuredTextSchema.parse(input);
  return enforceContract(parsed);
}

/**
 * Converts raw model text into enforced structured response contract.
 * @param raw Raw assistant text
 * @returns Structured contract
 */
export function buildStructuredResponse(raw: string): StructuredTextResponse {
  const trimmed = raw.trim();
  const language = detectLanguage(trimmed);
  const sentences = toSentences(trimmed);
  const answer = pickAnswer(sentences, language);
  const details = pickDetails(sentences, answer, language);
  const nextStep = pickNextStep(sentences, language);

  return ensureStructuredResponse({ answer, details, nextStep });
}
