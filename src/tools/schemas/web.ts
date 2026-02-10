import { z } from "zod";

export const webSearchSchema = z.object({
  query: z.string().min(1).max(500),
  count: z.number().int().min(1).max(20).optional(),
});

export const webSummarizeSchema = z.object({
  url: z.string().url().max(2000),
});

export type WebSearchArgs = z.infer<typeof webSearchSchema>;
export type WebSummarizeArgs = z.infer<typeof webSummarizeSchema>;
