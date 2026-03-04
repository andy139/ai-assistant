import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import type { TelegramReplyArgs } from "../schemas/telegram.js";
import type { ToolResult } from "../registry.js";

export async function telegramReply(args: TelegramReplyArgs): Promise<ToolResult> {
  if (!config.telegram.botToken) {
    return { ok: false, data: null, summary: "Telegram bot token not configured" };
  }

  const API = `https://api.telegram.org/bot${config.telegram.botToken}`;

  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: args.chatId, text: args.message }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error("Telegram send failed", { status: res.status, body });
      return { ok: false, data: null, summary: `Telegram send failed: ${res.status}` };
    }

    logger.info("Telegram message sent", { chatId: args.chatId });
    return { ok: true, data: null, summary: `Telegram message sent to ${args.chatId}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("Telegram send error", { error: msg });
    return { ok: false, data: null, summary: `Telegram failed: ${msg}` };
  }
}
