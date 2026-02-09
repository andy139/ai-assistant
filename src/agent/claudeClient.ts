import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.claude.apiKey });
  }
  return client;
}

/**
 * Send a message to Claude with a given system prompt.
 * Returns the raw text response (expected to be strict JSON).
 */
export async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const anthropic = getClient();

  logger.debug("Calling Claude", {
    model: config.claude.model,
    systemLen: systemPrompt.length,
    userLen: userMessage.length,
  });

  const response = await anthropic.messages.create({
    model: config.claude.model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "";

  logger.debug("Claude response", { length: text.length, stopReason: response.stop_reason });

  return text;
}
