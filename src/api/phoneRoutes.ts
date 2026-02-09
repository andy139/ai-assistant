import { Router } from "express";
import { requireAssistantKey } from "../utils/security.js";
import { executeCommand } from "../executor/executor.js";
import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";

export const phoneRouter = Router();

/**
 * POST /phone/webhook
 * Phone-safe webhook endpoint. Requires X-ASSISTANT-KEY header.
 * Body: { message: string }
 */
phoneRouter.post("/phone/webhook", requireAssistantKey, async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty 'message' field" });
    return;
  }

  logger.info("Phone webhook received", { message: message.slice(0, 100) });

  try {
    const result = await executeCommand(message.trim(), "phone");
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    logger.error("Phone webhook error", { error: msg });
    res.status(500).json({ error: msg });
  }
});
