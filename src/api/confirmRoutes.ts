import { Router } from "express";
import { getPendingConfirmations, resolveConfirmation } from "../executor/confirmations.js";
import { executeConfirmedAction } from "../executor/executor.js";
import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";

export const confirmRouter = Router();

/**
 * GET /confirm/pending
 * List all actions waiting for confirmation.
 */
confirmRouter.get("/confirm/pending", async (_req: Request, res: Response) => {
  const pending = await getPendingConfirmations();
  res.json({
    pending: pending.map((a) => ({
      id: a.id,
      type: a.type,
      args: JSON.parse(a.args),
      commandMessage: a.command.message,
      source: a.command.source,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

/**
 * POST /confirm
 * Confirm or deny a pending action.
 * Body: { id: string, decision: "confirm" | "deny" }
 */
confirmRouter.post("/confirm", async (req: Request, res: Response) => {
  const { id, decision } = req.body as { id?: string; decision?: string };

  if (!id || !decision || !["confirm", "deny"].includes(decision)) {
    res.status(400).json({ error: "Required: { id: string, decision: 'confirm' | 'deny' }" });
    return;
  }

  const action = await resolveConfirmation(id, decision as "confirm" | "deny");
  if (!action) {
    res.status(404).json({ error: "No pending action found with that ID" });
    return;
  }

  if (decision === "deny") {
    res.json({ status: "denied", actionId: id, type: action.type });
    return;
  }

  // Execute the confirmed action
  const result = await executeConfirmedAction(id);
  logger.info("Confirmed action executed", { actionId: id, status: result.status });

  res.json({
    status: result.status,
    actionId: id,
    type: result.type,
    result: result.result,
    error: result.error,
  });
});
