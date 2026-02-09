import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import type { DiscordPostArgs } from "../schemas/discord.js";
import type { ToolResult } from "../registry.js";

export async function discordPost(args: DiscordPostArgs): Promise<ToolResult> {
  if (!config.discord.webhookUrl) {
    return { ok: false, data: null, summary: "Discord webhook URL not configured" };
  }

  const res = await fetch(config.discord.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: args.content }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error("Discord webhook failed", { status: res.status, body });
    return { ok: false, data: null, summary: `Discord post failed (${res.status})` };
  }

  return { ok: true, data: null, summary: "Posted to Discord" };
}
