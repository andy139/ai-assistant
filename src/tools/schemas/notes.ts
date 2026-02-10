import { z } from "zod";

export const notesCreateSchema = z.object({
  content: z.string().min(1).max(5000),
  tag: z.string().max(100).optional(),
});

export const notesSearchSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(100).optional(),
});

export const notesListSchema = z.object({
  tag: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type NotesCreateArgs = z.infer<typeof notesCreateSchema>;
export type NotesSearchArgs = z.infer<typeof notesSearchSchema>;
export type NotesListArgs = z.infer<typeof notesListSchema>;
