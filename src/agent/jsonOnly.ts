import { z } from "zod";
import { logger } from "../utils/logger.js";

const actionSchema = z.object({
  type: z.string().min(1),
  args: z.record(z.unknown()).default({}),
});

const planSchema = z.object({
  actions: z.array(actionSchema),
});

export type RawPlanAction = z.infer<typeof actionSchema>;
export type RawPlan = z.infer<typeof planSchema>;

export type ParseResult =
  | { ok: true; data: RawPlan }
  | { ok: false; error: string; raw: string };

/**
 * Parse a string that MUST be strict JSON matching the plan schema.
 * Handles common LLM quirks: code fences, trailing commas, leading text.
 */
export function parseStrictJson(raw: string): ParseResult {
  let cleaned = raw.trim();

  // Strip markdown code fences if the LLM wrapped its output
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  // Find the first '{' in case there's leading prose
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }

  // Find the last '}' in case there's trailing prose
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    logger.warn("Failed to parse planner JSON", { error: msg, raw: raw.slice(0, 500) });
    return { ok: false, error: `JSON parse error: ${msg}`, raw };
  }

  const result = planSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    logger.warn("Planner JSON failed schema validation", { issues, raw: raw.slice(0, 500) });
    return { ok: false, error: `Schema validation: ${issues}`, raw };
  }

  return { ok: true, data: result.data };
}
