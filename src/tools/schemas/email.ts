import { z } from "zod";

export const emailListSchema = z.object({
  from: z.string().optional(),
  subject: z.string().optional(),
  label: z.string().optional(),
  unreadOnly: z.boolean().optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
});

export const emailReadSchema = z.object({
  id: z.string().min(1),
});

export const emailSummarizeSchema = z.object({
  maxResults: z.number().int().min(1).max(20).optional(),
});

export const emailSendSchema = z.object({
  to: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  cc: z.string().optional(),
});

export const emailArchiveSchema = z.object({
  id: z.string().min(1),
});

export type EmailListArgs = z.infer<typeof emailListSchema>;
export type EmailReadArgs = z.infer<typeof emailReadSchema>;
export type EmailSummarizeArgs = z.infer<typeof emailSummarizeSchema>;
export type EmailSendArgs = z.infer<typeof emailSendSchema>;
export type EmailArchiveArgs = z.infer<typeof emailArchiveSchema>;
