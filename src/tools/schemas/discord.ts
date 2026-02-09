import { z } from "zod";

export const discordPostSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type DiscordPostArgs = z.infer<typeof discordPostSchema>;
