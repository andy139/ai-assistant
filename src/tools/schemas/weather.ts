import { z } from "zod";

export const weatherCurrentSchema = z.object({
  location: z.string().min(1).max(200),
});

export type WeatherCurrentArgs = z.infer<typeof weatherCurrentSchema>;
