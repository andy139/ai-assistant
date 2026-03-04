import { db } from "../store/db.js";
import { logger } from "../utils/logger.js";

/**
 * Retrieve all actions pending confirmation.
 */
export async function getPendingConfirmations() {
  return db.action.findMany({
    where: { status: "pending_confirm" },
    orderBy: { createdAt: "desc" },
    include: { command: { select: { message: true, source: true } } },
  });
}

/**
 * Get the most recent pending confirmation action.
 */
export async function getLatestPendingConfirmation() {
  return db.action.findFirst({
    where: { status: "pending_confirm" },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Resolve all pending confirmations at once.
 * Returns the list of resolved actions.
 */
export async function resolveAllPending(decision: "confirm" | "deny") {
  const pending = await db.action.findMany({
    where: { status: "pending_confirm" },
    orderBy: { createdAt: "asc" },
  });

  const newStatus = decision === "confirm" ? "confirmed" : "denied";

  for (const action of pending) {
    await db.action.update({
      where: { id: action.id },
      data: { status: newStatus },
    });
  }

  if (pending.length) {
    logger.info("All confirmations resolved", { decision, count: pending.length });
  }

  return pending;
}

/**
 * Confirm or deny a pending action by ID.
 * Returns the updated action, or null if not found / not pending.
 */
export async function resolveConfirmation(
  actionId: string,
  decision: "confirm" | "deny",
) {
  const action = await db.action.findUnique({ where: { id: actionId } });

  if (!action || action.status !== "pending_confirm") {
    logger.warn("Confirmation resolve failed: not found or not pending", { actionId });
    return null;
  }

  const newStatus = decision === "confirm" ? "confirmed" : "denied";

  const updated = await db.action.update({
    where: { id: actionId },
    data: { status: newStatus },
  });

  logger.info("Confirmation resolved", { actionId, decision, tool: updated.type });

  return updated;
}
