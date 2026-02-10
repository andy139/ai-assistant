import { z } from "zod";

export const tasksCreateSchema = z.object({
  title: z.string().min(1).max(500),
  dueAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(2000).optional(),
});

export const tasksListSchema = z.object({
  status: z.enum(["open", "done"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const tasksCompleteSchema = z.object({
  id: z.string().uuid(),
});

export const tasksDeleteSchema = z.object({
  id: z.string().uuid(),
});

export type TasksCreateArgs = z.infer<typeof tasksCreateSchema>;
export type TasksListArgs = z.infer<typeof tasksListSchema>;
export type TasksCompleteArgs = z.infer<typeof tasksCompleteSchema>;
export type TasksDeleteArgs = z.infer<typeof tasksDeleteSchema>;
