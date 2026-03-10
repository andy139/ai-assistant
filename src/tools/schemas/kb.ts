import { z } from "zod";

export const kbIngestSchema = z
  .object({
    title: z.string().describe("Document title"),
    content: z.string().describe("Text content to ingest"),
    source: z.enum(["text", "url"]).default("text"),
  })
  .strict();

export const kbSearchSchema = z
  .object({
    query: z.string().describe("Natural language query to search the knowledge base"),
    topK: z.number().int().min(1).max(10).default(3).optional(),
  })
  .strict();

export const kbListSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20).optional(),
  })
  .strict();

export type KbIngestArgs = z.infer<typeof kbIngestSchema>;
export type KbSearchArgs = z.infer<typeof kbSearchSchema>;
export type KbListArgs = z.infer<typeof kbListSchema>;
