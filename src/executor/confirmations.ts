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
