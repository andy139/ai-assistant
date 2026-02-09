import { z } from "zod";

export const smsReplySchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1).max(1600),
});

export type SmsReplyArgs = z.infer<typeof smsReplySchema>;
