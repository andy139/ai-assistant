import { callClaude } from "./claudeClient.js";
import { buildPlannerPrompt } from "./systemPrompt.js";
import { parseStrictJson } from "./jsonOnly.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { PlannerError, ValidationError } from "../utils/errors.js";

export interface PlannerAction {
  type: string;
  args: Record<string, unknown>;
}

export interface PlanResult {
  actions: PlannerAction[];
  rawResponse: string;
}

/**
 * Takes a user message, calls Claude as a strict JSON planner,
 * and returns a validated list of actions.
 */
export async function plan(userMessage: string): Promise<PlanResult> {
  const now = new Date().toISOString();
  const augmentedMessage = `[Current time: ${now}]\n\nUser command: ${userMessage}`;

  const systemPrompt = buildPlannerPrompt();
  const rawResponse = await callClaude(systemPrompt, augmentedMessage);

  const parsed = parseStrictJson(rawResponse);

  if (!parsed.ok) {
    logger.error("Planner returned invalid JSON", { error: parsed.error, raw: rawResponse });
    throw new PlannerError(`Planner returned invalid JSON: ${parsed.error}`, rawResponse);
  }

  const actions = parsed.data.actions;

  if (actions.length > config.maxActions) {
    throw new ValidationError(
      `Plan contains ${actions.length} actions, max is ${config.maxActions}`,
    );
  }

  logger.info("Plan generated", {
    actionCount: actions.length,
    tools: actions.map((a) => a.type),
  });

  return {
    actions: actions as PlannerAction[],
    rawResponse,
  };
}
