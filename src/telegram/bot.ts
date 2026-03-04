import { config } from "../config/index.js";
import { executeCommand, executeConfirmedAction } from "../executor/executor.js";
import { resolveConfirmation, getLatestPendingConfirmation, resolveAllPending } from "../executor/confirmations.js";
import { logger } from "../utils/logger.js";

const API = `https://api.telegram.org/bot${config.telegram.botToken}`;
let offset = 0;
let running = false;

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  const body = { chat_id: chatId, text: text.slice(0, 4096) };
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    logger.error("Telegram sendMessage failed", { status: res.status, chatId });
  }
}

export { sendMessage as telegramSendMessage };

async function handleMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text) return;

  logger.info("Telegram message received", { chatId, message: text.slice(0, 100) });

  try {
    let replyText: string;

    // Handle "confirm all" / "yes all" / "deny all"
    const allConfirm = /^(yes|confirm)\s+all$/i.test(text);
    const allDeny = /^(no|deny)\s+all$/i.test(text);

    // Handle "confirm <id>" / "deny <id>"
    const confirmMatch = text.match(/^(confirm|deny)\s+([a-f0-9-]+)/i);

    // Handle bare "yes" / "no"
    const bareConfirm = /^(yes|confirm|yep|yea|yeah|y)$/i.test(text);
    const bareDeny = /^(no|deny|nope|nah|n)$/i.test(text);

    if (allConfirm || allDeny) {
      const decision = allConfirm ? "confirm" : "deny";
      const actions = await resolveAllPending(decision);
      if (!actions.length) {
        replyText = "Nothing pending to confirm.";
      } else if (decision === "confirm") {
        const results = [];
        for (const action of actions) {
          const result = await executeConfirmedAction(action.id);
          results.push(result.status === "executed"
            ? (result.result?.summary ?? result.type)
            : `${result.type} failed: ${result.error}`);
        }
        replyText = `Confirmed ${actions.length} action(s):\n${results.map(r => `- ${r}`).join("\n")}`;
      } else {
        replyText = `Denied ${actions.length} action(s).`;
      }
    } else if (confirmMatch || bareConfirm || bareDeny) {
      let actionId: string | null = confirmMatch?.[2] ?? null;
      const decision: "confirm" | "deny" = (confirmMatch
        ? confirmMatch[1].toLowerCase() === "deny"
        : bareDeny) ? "deny" : "confirm";

      if (!actionId) {
        const latest = await getLatestPendingConfirmation();
        actionId = latest?.id ?? null;
      }

      if (!actionId) {
        replyText = "Nothing pending to confirm.";
      } else {
        const action = await resolveConfirmation(actionId, decision);
        if (!action) {
          replyText = `No pending action found for ID: ${actionId.slice(0, 8)}`;
        } else if (decision === "confirm") {
          const result = await executeConfirmedAction(actionId);
          replyText = result.status === "executed"
            ? `Confirmed & executed: ${result.result?.summary ?? result.type}`
            : `Confirmed but failed: ${result.error ?? "unknown error"}`;
        } else {
          replyText = `Denied: ${action.type} (${actionId.slice(0, 8)})`;
        }
      }
    } else {
      const result = await executeCommand(text, "telegram", String(chatId));
      replyText = result.summary;
    }

    await sendMessage(chatId, replyText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    logger.error("Telegram processing error", { chatId, error: msg });
    await sendMessage(chatId, "Error processing your request. Try again.");
  }
}

async function poll(): Promise<void> {
  while (running) {
    try {
      const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=30`, {
        signal: AbortSignal.timeout(35_000),
      });

      if (!res.ok) {
        logger.error("Telegram getUpdates failed", { status: res.status });
        await sleep(5000);
        continue;
      }

      const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
      if (!data.ok || !data.result.length) continue;

      for (const update of data.result) {
        offset = update.update_id + 1;
        if (update.message) {
          // Fire and forget — don't block polling for slow commands
          handleMessage(update.message).catch((err) => {
            logger.error("Telegram handler error", { error: String(err) });
          });
        }
      }
    } catch (err) {
      // Network errors, timeouts — just retry
      if (running) await sleep(3000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startTelegramBot(): void {
  if (!config.telegram.botToken) {
    logger.info("Telegram bot disabled (no TELEGRAM_BOT_TOKEN)");
    return;
  }

  running = true;
  logger.info("Telegram bot started (long polling)");
  console.log(`  Telegram: Bot polling active`);
  poll();
}

export function stopTelegramBot(): void {
  running = false;
}
