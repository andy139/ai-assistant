import { z } from "zod";

export const bookmarksSaveSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  tag: z.string().max(100).optional(),
});

export const bookmarksListSchema = z.object({
  tag: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type BookmarksSaveArgs = z.infer<typeof bookmarksSaveSchema>;
export type BookmarksListArgs = z.infer<typeof bookmarksListSchema>;
