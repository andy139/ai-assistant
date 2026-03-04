import cron from "node-cron";
import { db } from "../store/db.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { telegramSendMessage } from "../telegram/bot.js";
import { discordSendDM } from "../discord/bot.js";
import twilio from "twilio";

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

    // Send notification
    if (reminder.source === "telegram" && reminder.chatId) {
      await telegramSendMessage(
        Number(reminder.chatId),
        `\u23F0 Reminder:\n${reminder.text}`,
      ).catch((err) => {
        logger.error("Failed to send reminder notification", {
          id: reminder.id,
          error: String(err),
        });
      });
    } else if (reminder.source === "discord" && reminder.chatId) {
      await discordSendDM(reminder.chatId, `⏰ Reminder: ${reminder.text}`).catch((err) => {
        logger.error("Failed to send Discord reminder", {
          id: reminder.id,
          error: String(err),
        });
      });
    } else if (reminder.source === "sms" && reminder.chatId && config.twilio.accountSid && config.twilio.authToken) {
      const client = twilio(config.twilio.accountSid, config.twilio.authToken);
      await client.messages.create({
        to: reminder.chatId,
        ...(config.twilio.messagingServiceSid
          ? { messagingServiceSid: config.twilio.messagingServiceSid }
          : { from: config.twilio.phoneNumber }),
        body: `⏰ Reminder: ${reminder.text}`,
      }).catch((err) => {
        logger.error("Failed to send SMS reminder", {
          id: reminder.id,
          error: String(err),
        });
      });
    }
  }
}
