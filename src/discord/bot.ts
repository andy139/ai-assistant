import { Client, GatewayIntentBits, Partials, type Message } from "discord.js";
import { config } from "../config/index.js";
import { executeCommand, executeConfirmedAction } from "../executor/executor.js";
import { resolveConfirmation, getLatestPendingConfirmation, resolveAllPending } from "../executor/confirmations.js";
import { getHistory, addToHistory } from "../agent/conversationHistory.js";
import { logger } from "../utils/logger.js";

let client: Client | null = null;

export async function discordSendDM(userId: string, text: string): Promise<void> {
  if (!client) return;
  try {
    const user = await client.users.fetch(userId);
    const dm = await user.createDM();
    // Discord message limit is 2000 chars
    const chunks = splitMessage(text, 2000);
    for (const chunk of chunks) {
      await dm.send(chunk);
    }
  } catch (err) {
    logger.error("Discord DM failed", { userId, error: String(err) });
  }
}

function splitMessage(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  while (text.length > 0) {
    chunks.push(text.slice(0, limit));
    text = text.slice(limit);
  }
  return chunks;
}

async function handleMessage(msg: Message): Promise<void> {
  // Only respond to DMs from the configured user
  if (msg.author.bot) return;
  logger.info("Discord message event", { channelType: msg.channel.type, authorId: msg.author.id });
  if (msg.channel.type !== 1 /* DM */) return;
  if (config.discord.userId && msg.author.id !== config.discord.userId) return;

  const text = msg.content.trim();
  if (!text) return;

  logger.info("Discord DM received", { userId: msg.author.id, message: text.slice(0, 100) });

  try {
    let replyText: string;

    const allConfirm = /^(yes|confirm)\s+all$/i.test(text);
    const allDeny = /^(no|deny)\s+all$/i.test(text);
    const confirmMatch = text.match(/^(confirm|deny)\s+([a-f0-9-]+)/i);
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
      const history = getHistory(msg.author.id);
      const result = await executeCommand(text, "discord", msg.author.id, history);
      replyText = result.summary;
      addToHistory(msg.author.id, { userMessage: text, assistantReply: replyText });
    }

    const chunks = splitMessage(replyText, 2000);
    for (const chunk of chunks) {
      await msg.reply(chunk);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal error";
    logger.error("Discord processing error", { userId: msg.author.id, error: errMsg });
    await msg.reply("Error processing your request. Try again.");
  }
}

export function startDiscordBot(): void {
  if (!config.discord.botToken) {
    logger.info("Discord bot disabled (no DISCORD_BOT_TOKEN)");
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once("ready", () => {
    logger.info("Discord bot ready", { tag: client?.user?.tag });
    console.log(`  Discord: Bot online as ${client?.user?.tag}`);
  });

  client.on("messageCreate", (msg) => {
    handleMessage(msg).catch((err) => {
      logger.error("Discord handler error", { error: String(err) });
    });
  });

  client.login(config.discord.botToken).catch((err) => {
    logger.error("Discord bot login failed", { error: String(err) });
  });
}

export function stopDiscordBot(): void {
  client?.destroy();
  client = null;
}
