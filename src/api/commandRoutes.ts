import { Router } from "express";
import { executeCommand } from "../executor/executor.js";
import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";

export const commandRouter = Router();

/**
 * POST /command
 * Local command endpoint — no auth required (local-only access).
 * Body: { message: string }
 */
commandRouter.post("/command", async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty 'message' field" });
    return;
  }

  logger.info("Command received", { source: "http", message: message.slice(0, 100) });

  try {
    const result = await executeCommand(message.trim(), "http");
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    logger.error("Command endpoint error", { error: msg });
    res.status(500).json({ error: msg });
  }
});
