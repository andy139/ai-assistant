import { z } from "zod";

export const remindersCreateSchema = z.object({
  text: z.string().min(1).max(500),
  runAt: z.string().datetime({ offset: true }),
});

export type RemindersCreateArgs = z.infer<typeof remindersCreateSchema>;
