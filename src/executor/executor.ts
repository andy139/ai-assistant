import { db } from "../store/db.js";
import { config } from "../config/index.js";
import { plan } from "../agent/planner.js";
import { validatePlan } from "./validator.js";
import { getTool } from "../tools/registry.js";
import { logger } from "../utils/logger.js";
import type { PlannerAction } from "../agent/planner.js";
import type { ToolResult } from "../tools/registry.js";

export interface ActionResult {
  actionId: string;
  type: string;
  status: string;
  result?: ToolResult;
  error?: string;
}

export interface CommandResult {
  commandId: string;
  status: string;
  actions: ActionResult[];
  errors: string[];
  summary: string;
}

/**
 * Full command pipeline:
 *  1. Persist the command
 *  2. Plan via Claude
 *  3. Validate all actions
 *  4. Execute or queue for confirmation
 *  5. Return results
 */
export async function executeCommand(
  message: string,
  source: "sms" | "http" | "cli" | "phone",
  from?: string,
): Promise<CommandResult> {
  // 1. Persist command
  const command = await db.command.create({
    data: { message, source, from: from ?? null, status: "received" },
  });

  const actionResults: ActionResult[] = [];
  const errors: string[] = [];

  try {
    // 2. Plan
    await db.command.update({ where: { id: command.id }, data: { status: "planned" } });
    const planResult = await plan(message);
    await db.command.update({
      where: { id: command.id },
      data: { planJson: JSON.stringify(planResult.actions) },
    });

    // 3. Validate
    const { valid, errors: validationErrors } = validatePlan(planResult.actions);

    for (const err of validationErrors) {
      errors.push(`${err.action.type}: ${err.error}`);
      await db.action.create({
        data: {
          commandId: command.id,
          type: err.action.type,
          args: JSON.stringify(err.action.args),
          status: "failed",
          confirmLevel: "none",
          error: err.error,
        },
      });
    }

    // 4. Execute or queue
    await db.command.update({ where: { id: command.id }, data: { status: "executing" } });

    for (const validAction of valid) {
      const tool = getTool(validAction.type)!;

      // Persist the action
      const action = await db.action.create({
        data: {
          commandId: command.id,
          type: validAction.type,
          args: JSON.stringify(validAction.args),
          status: "pending",
          confirmLevel: tool.confirmation,
        },
      });

      // DRY_RUN mode: log but don't execute
      if (config.dryRun) {
        await db.action.update({
          where: { id: action.id },
          data: { status: "dry_run", result: JSON.stringify({ dryRun: true }) },
        });
        actionResults.push({
          actionId: action.id,
          type: validAction.type,
          status: "dry_run",
        });
        logger.info("DRY RUN action", { tool: validAction.type, args: validAction.args });
        continue;
      }

      // Hard-confirm: queue for user confirmation
      if (tool.confirmation === "hard") {
        await db.action.update({
          where: { id: action.id },
          data: { status: "pending_confirm" },
        });
        actionResults.push({
          actionId: action.id,
          type: validAction.type,
          status: "pending_confirm",
        });
        logger.info("Action queued for confirmation", {
          actionId: action.id,
          tool: validAction.type,
        });
        continue;
      }

      // Execute the action
      const result = await executeAction(action.id, validAction.type, validAction.validatedArgs);
      actionResults.push(result);
    }

    // Check for delegated sub-agent actions
    await processDelegatedActions(command.id, actionResults);

    // 5. Finalize command
    const finalStatus = errors.length > 0 ? "completed" : "completed";
    await db.command.update({ where: { id: command.id }, data: { status: finalStatus } });

    return {
      commandId: command.id,
      status: finalStatus,
      actions: actionResults,
      errors,
      summary: buildSummary(actionResults, errors),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("Command execution failed", { commandId: command.id, error: msg });
    await db.command.update({
      where: { id: command.id },
      data: { status: "failed", error: msg },
    });
    return {
      commandId: command.id,
      status: "failed",
      actions: actionResults,
      errors: [msg],
      summary: `Failed: ${msg}`,
    };
  }
}

/**
 * Execute a single confirmed action by ID.
 * Used both during initial execution and when confirming pending actions.
 */
export async function executeAction(
  actionId: string,
  toolName: string,
  args: unknown,
): Promise<ActionResult> {
  const tool = getTool(toolName);
  if (!tool) {
    return { actionId, type: toolName, status: "failed", error: `Unknown tool: ${toolName}` };
  }

  try {
    const result = await tool.execute(args);

    await db.action.update({
      where: { id: actionId },
      data: {
        status: result.ok ? "executed" : "failed",
        result: JSON.stringify(result),
        executedAt: new Date(),
        error: result.ok ? null : result.summary,
      },
    });

    logger.info("Action executed", { actionId, tool: toolName, ok: result.ok });
    return { actionId, type: toolName, status: result.ok ? "executed" : "failed", result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db.action.update({
      where: { id: actionId },
      data: { status: "failed", error: msg },
    });
    logger.error("Action execution failed", { actionId, tool: toolName, error: msg });
    return { actionId, type: toolName, status: "failed", error: msg };
  }
}

/**
 * After executing agent.delegate, process the returned sub-actions.
 * Sub-agent actions go through the same validation + confirmation flow.
 */
async function processDelegatedActions(
  commandId: string,
  actionResults: ActionResult[],
): Promise<void> {
  for (const result of [...actionResults]) {
    if (result.type !== "agent.delegate" || result.status !== "executed") continue;
    if (!result.result?.ok) continue;

    const data = result.result.data as { delegatedActions?: PlannerAction[] } | null;
    if (!data?.delegatedActions?.length) continue;

    const { valid, errors: validationErrors } = validatePlan(data.delegatedActions);

    for (const err of validationErrors) {
      logger.warn("Sub-agent action validation failed", {
        tool: err.action.type,
        error: err.error,
      });
    }

    for (const validAction of valid) {
      const tool = getTool(validAction.type)!;

      const action = await db.action.create({
        data: {
          commandId,
          type: validAction.type,
          args: JSON.stringify(validAction.args),
          status: "pending",
          confirmLevel: tool.confirmation,
        },
      });

      if (config.dryRun) {
        await db.action.update({
          where: { id: action.id },
          data: { status: "dry_run" },
        });
        actionResults.push({ actionId: action.id, type: validAction.type, status: "dry_run" });
        continue;
      }

      if (tool.confirmation === "hard") {
        await db.action.update({
          where: { id: action.id },
          data: { status: "pending_confirm" },
        });
        actionResults.push({
          actionId: action.id,
          type: validAction.type,
          status: "pending_confirm",
        });
        continue;
      }

      const subResult = await executeAction(
        action.id,
        validAction.type,
        validAction.validatedArgs,
      );
      actionResults.push(subResult);
    }
  }
}

function buildSummary(actions: ActionResult[], errors: string[]): string {
  const parts: string[] = [];

  const executed = actions.filter((a) => a.status === "executed");
  const pending = actions.filter((a) => a.status === "pending_confirm");
  const dryRun = actions.filter((a) => a.status === "dry_run");
  const failed = actions.filter((a) => a.status === "failed");

  if (executed.length) {
    parts.push(
      `Done: ${executed.map((a) => a.result?.summary ?? a.type).join("; ")}`,
    );
  }
  if (pending.length) {
    parts.push(
      `Needs confirm: ${pending.map((a) => `${a.type} (${a.actionId.slice(0, 8)})`).join(", ")}`,
    );
  }
  if (dryRun.length) {
    parts.push(`[DRY RUN] ${dryRun.length} action(s) logged`);
  }
  if (failed.length || errors.length) {
    parts.push(`Errors: ${failed.length + errors.length}`);
  }

  return parts.join(" | ") || "No actions taken";
}

/**
 * Execute a previously confirmed action.
 */
export async function executeConfirmedAction(actionId: string): Promise<ActionResult> {
  const action = await db.action.findUnique({ where: { id: actionId } });
  if (!action) {
    return { actionId, type: "unknown", status: "failed", error: "Action not found" };
  }

  const args = JSON.parse(action.args);
  const tool = getTool(action.type);
  if (!tool) {
    return { actionId, type: action.type, status: "failed", error: `Unknown tool: ${action.type}` };
  }

  // Re-validate args
  const validated = tool.schema.safeParse(args);
  if (!validated.success) {
    return { actionId, type: action.type, status: "failed", error: "Args no longer valid" };
  }

  return executeAction(actionId, action.type, validated.data);
}
