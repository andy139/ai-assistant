import { z } from "zod";

export const historyQuerySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

export type HistoryQueryArgs = z.infer<typeof historyQuerySchema>;
