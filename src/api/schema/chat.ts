import { z } from "zod";

export const chatRequestSchema = z.object({
  threadId: z.string().uuid().optional(),
  message: z.string().min(1).max(10000),
  userId: z.string().min(1)
});

export const chatResponseSchema = z.object({
  threadId: z.string().uuid(),
  status: z.literal("sent")
});
