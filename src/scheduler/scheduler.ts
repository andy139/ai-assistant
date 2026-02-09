import cron from "node-cron";
import { db } from "../store/db.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

let task: cron.ScheduledTask | null = null;

/**
 * Start the reminder scheduler. Runs every minute, checks for due reminders,
 * and fires them (currently logs + marks fired; SMS notification can be added).
 */
export function startScheduler(): void {
  if (task) return;

  task = cron.schedule("* * * * *", async () => {
    try {
      await checkReminders();
    } catch (err) {
      logger.error("Scheduler tick failed", {
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  });

  logger.info("Reminder scheduler started (every 60s)");
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
    logger.info("Reminder scheduler stopped");
  }
}

async function checkReminders(): Promise<void> {
  const now = new Date();

  const due = await db.reminder.findMany({
    where: {
      fired: false,
      runAt: { lte: now },
    },
    orderBy: { runAt: "asc" },
  });

  if (due.length === 0) return;

  logger.info("Processing due reminders", { count: due.length });

  for (const reminder of due) {
    if (config.dryRun) {
      logger.info("[DRY RUN] Reminder would fire", { id: reminder.id, text: reminder.text });
      continue;
    }

    // Mark as fired
    await db.reminder.update({
      where: { id: reminder.id },
      data: { fired: true, result: `Fired at ${now.toISOString()}` },
    });

    logger.info("Reminder fired", { id: reminder.id, text: reminder.text });

    // If Twilio is configured, we could send an SMS here.
    // For V1, we just log it. The web UI shows fired reminders.
  }
}
