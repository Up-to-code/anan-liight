import { z } from "zod";

export const createPartnerPropertySchema = z.object({
  partnerId: z.string().min(1),
  title: z.string().min(1),
  address: z.string().min(1),
  description: z.string().min(1),
  price: z.number().positive(),
  beds: z.number().int().positive(),
  baths: z.number().int().positive()
});
