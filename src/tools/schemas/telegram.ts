import { z } from "zod";

export const telegramReplySchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1).max(4096),
});

export type TelegramReplyArgs = z.infer<typeof telegramReplySchema>;
