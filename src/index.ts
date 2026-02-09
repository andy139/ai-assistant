import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config/index.js";
import { ensureDbReady } from "./store/db.js";
import { commandRouter } from "./api/commandRoutes.js";
import { smsRouter } from "./api/smsRoutes.js";
import { historyRouter } from "./api/historyRoutes.js";
import { confirmRouter } from "./api/confirmRoutes.js";
import { phoneRouter } from "./api/phoneRoutes.js";
import { uiRouter } from "./ui/uiRoutes.js";
import { startScheduler } from "./scheduler/scheduler.js";
import { logger } from "./utils/logger.js";
import { AppError } from "./utils/errors.js";
import type { Request, Response, NextFunction } from "express";

async function main() {
  // Verify database connection
  await ensureDbReady();
  logger.info("Database connected");

  const app = express();

  // --- Middleware ---

  // Parse URL-encoded bodies (Twilio sends form data)
  app.use(express.urlencoded({ extended: false }));

  // Parse JSON bodies
  app.use(express.json());

  // Rate limiting for inbound endpoints
  const limiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 30,              // 30 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, slow down" },
  });
  app.use(limiter);

  // --- Routes ---

  app.use(uiRouter);          // GET /
  app.use(commandRouter);     // POST /command
  app.use(smsRouter);         // POST /sms/inbound
  app.use(phoneRouter);       // POST /phone/webhook
  app.use(historyRouter);     // GET /history
  app.use(confirmRouter);     // GET /confirm/pending, POST /confirm

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", dryRun: config.dryRun, uptime: process.uptime() });
  });

  // --- Error handler ---

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      logger.warn("App error", { code: err.code, message: err.message });
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }

    logger.error("Unhandled error", {
      message: err.message,
      stack: err.stack?.slice(0, 500),
    });
    res.status(500).json({ error: "Internal server error" });
  });

  // --- Start ---

  startScheduler();

  app.listen(config.port, () => {
    logger.info("Server started", {
      port: config.port,
      dryRun: config.dryRun,
      maxActions: config.maxActions,
    });
    console.log(`\n  AI Assistant Orchestrator`);
    console.log(`  ========================`);
    console.log(`  UI:       http://localhost:${config.port}`);
    console.log(`  Command:  POST http://localhost:${config.port}/command`);
    console.log(`  SMS:      POST http://localhost:${config.port}/sms/inbound`);
    console.log(`  Phone:    POST http://localhost:${config.port}/phone/webhook`);
    console.log(`  Health:   GET  http://localhost:${config.port}/health`);
    console.log(`  DRY_RUN:  ${config.dryRun}`);
    console.log();
  });
}

main().catch((err) => {
  logger.error("Fatal startup error", { error: err.message });
  console.error(err);
  process.exit(1);
});
