import { getSubAgent } from "../../subagents/index.js";
import { callClaude } from "../../agent/claudeClient.js";
import { parseStrictJson } from "../../agent/jsonOnly.js";
import { logger } from "../../utils/logger.js";
import type { AgentDelegateArgs } from "../schemas/agentDelegate.js";
import type { ToolResult } from "../registry.js";
import type { PlannerAction } from "../../agent/planner.js";

export async function agentDelegate(args: AgentDelegateArgs): Promise<ToolResult> {
  const agent = getSubAgent(args.agent);
  if (!agent) {
    return { ok: false, data: null, summary: `Unknown agent: ${args.agent}` };
  }

  logger.info("Delegating to sub-agent", { agent: args.agent, message: args.message });

  const rawResponse = await callClaude(agent.systemPrompt, args.message);
  const parsed = parseStrictJson(rawResponse);

  if (!parsed.ok) {
    logger.error("Sub-agent returned invalid JSON", {
      agent: args.agent,
      raw: rawResponse,
      error: parsed.error,
    });
    return {
      ok: false,
      data: { rawOutput: rawResponse },
      summary: `Agent "${args.agent}" returned invalid response`,
    };
  }

  const actions = parsed.data.actions as PlannerAction[];
  return {
    ok: true,
    data: { delegatedActions: actions },
    summary: `Agent "${args.agent}" returned ${actions.length} action(s)`,
  };
}
