import { z } from "zod";

export const refreshRequestSchema = z.object({
  sessionId: z.string().uuid().optional()
});

export const authCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});
