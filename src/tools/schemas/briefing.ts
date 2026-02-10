import { z } from "zod";

export const briefingGetSchema = z.object({
  location: z.string().min(1).max(200).optional(),
});

export type BriefingGetArgs = z.infer<typeof briefingGetSchema>;
