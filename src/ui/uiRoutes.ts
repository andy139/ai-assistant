import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uiRouter = Router();

uiRouter.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
