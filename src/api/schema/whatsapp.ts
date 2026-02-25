import { z } from "zod";

const simpleInboundSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1).max(10000),
  phoneNumber: z.string().min(6).optional(),
  messageId: z.string().optional(),
  inboundAt: z.number().int().positive().optional()
});

const cloudWebhookMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().optional(),
  text: z.object({ body: z.string().min(1) }).optional(),
  image: z.object({ id: z.string().optional(), caption: z.string().optional() }).optional(),
  audio: z.object({ id: z.string().optional() }).optional(),
  video: z.object({ id: z.string().optional(), caption: z.string().optional() }).optional(),
  document: z.object({ id: z.string().optional(), caption: z.string().optional() }).optional()
});

const cloudWebhookSchema = z.object({
  object: z.string().optional(),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            messages: z.array(cloudWebhookMessageSchema).optional()
          })
        })
      ).optional()
    })
  ).optional()
});

export const whatsappInboundSchema = z.union([simpleInboundSchema, cloudWebhookSchema]);

export type WhatsAppInboundInput = z.infer<typeof whatsappInboundSchema>;
