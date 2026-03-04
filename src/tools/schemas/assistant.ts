import { z } from "zod";

export const assistantReplySchema = z.object({
  text: z.string().min(1).max(5000),
});

export type AssistantReplyArgs = z.infer<typeof assistantReplySchema>;
