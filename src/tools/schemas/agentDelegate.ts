import { z } from "zod";

export const agentDelegateSchema = z.object({
  agent: z.enum(["job", "study", "fitness", "discordOps", "research"]),
  message: z.string().min(1).max(2000),
});

export type AgentDelegateArgs = z.infer<typeof agentDelegateSchema>;
