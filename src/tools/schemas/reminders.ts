import { z } from "zod";

export const remindersCreateSchema = z.object({
  text: z.string().min(1).max(500),
  runAt: z.string().datetime({ offset: true }),
});

export const remindersListSchema = z.object({
  status: z.enum(["pending", "fired"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type RemindersCreateArgs = z.infer<typeof remindersCreateSchema>;
export type RemindersListArgs = z.infer<typeof remindersListSchema>;
