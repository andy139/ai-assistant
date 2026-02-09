import { getTool, isKnownTool } from "../tools/registry.js";
import { ToolNotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { PlannerAction } from "../agent/planner.js";

export interface ValidatedAction {
  type: string;
  args: Record<string, unknown>;
  validatedArgs: unknown;
}

/**
 * Validate a single planner action:
 *  1. Tool must exist in the allowlist registry
 *  2. Args must pass the tool's Zod schema (rejects unknown fields)
 */
export function validateAction(action: PlannerAction): ValidatedAction {
  if (!isKnownTool(action.type)) {
    throw new ToolNotFoundError(action.type);
  }

  const tool = getTool(action.type)!;
  const result = tool.schema.safeParse(action.args);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    logger.warn("Action args validation failed", { tool: action.type, issues });
    throw new ValidationError(`Invalid args for ${action.type}: ${issues}`);
  }

  return {
    type: action.type,
    args: action.args,
    validatedArgs: result.data,
  };
}

/**
 * Validate all actions in a plan. Returns validated actions and any errors.
 */
export function validatePlan(
  actions: PlannerAction[],
): { valid: ValidatedAction[]; errors: Array<{ action: PlannerAction; error: string }> } {
  const valid: ValidatedAction[] = [];
  const errors: Array<{ action: PlannerAction; error: string }> = [];

  for (const action of actions) {
    try {
      valid.push(validateAction(action));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown validation error";
      errors.push({ action, error: msg });
    }
  }

  return { valid, errors };
}
