import { z } from "zod";

export const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.string(),
          content: z.string().nullable()
        })
      })
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional()
    })
    .optional()
});

export type ChatCompletion = z.infer<typeof chatCompletionSchema>;

export interface ModelAttemptConfig {
  model: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
