import { Router } from "express";
import { db } from "../store/db.js";
import type { Request, Response } from "express";

export const historyRouter = Router();

/**
 * GET /history?limit=50
 * Returns recent commands with their actions.
 */
historyRouter.get("/history", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

  const commands = await db.command.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  res.json({ commands, count: commands.length });
});
