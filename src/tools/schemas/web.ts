import { z } from "zod";

export const webSearchSchema = z.object({
  query: z.string().min(1).max(500),
  count: z.number().int().min(1).max(20).optional(),
});

export type WebSearchArgs = z.infer<typeof webSearchSchema>;
