/**
 * Research Agent — ReAct (Reasoning + Acting) loop
 *
 * Iteratively reasons about a topic, searches the web, evaluates results,
 * and synthesizes a final answer. Runs up to MAX_STEPS search iterations
 * before producing a synthesis. All results are returned as `assistant.reply`
 * actions through the standard pipeline.
 */
import { callClaude } from "../agent/claudeClient.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { webSearch } from "../tools/implementations/web.js";
import type { SubAgentDefinition } from "./index.js";

const MAX_STEPS = 3;

interface ThoughtAction {
  thought: string;
  action: "search" | "finish";
  query?: string;        // for action=search
  answer?: string;       // for action=finish
}

interface SearchResult {
  query: string;
  results: string;
}

/**
 * Run the ReAct loop for the given research task.
 * Returns the synthesized answer as a string.
 */
export async function runResearchLoop(task: string): Promise<string> {
  const observations: SearchResult[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const historyBlock = observations.length
      ? `\n\nPrevious searches and findings:\n${observations
          .map((o, i) => `Step ${i + 1} — Query: "${o.query}"\nResults:\n${o.results}`)
          .join("\n\n---\n\n")}`
      : "";

    const prompt = `You are a research agent. Your task: "${task}"${historyBlock}

Decide your next action. Output ONLY valid JSON:
- To search: { "thought": "why I need this info", "action": "search", "query": "search query" }
- To finish: { "thought": "I have enough info", "action": "finish", "answer": "full synthesized answer" }

If you have done ${step} search(es) and have useful information, prefer finishing with a synthesis.
Output only JSON, no other text.`;

    const raw = await callClaude(
      "You are a research planning agent that outputs only valid JSON.",
      prompt,
    );

    let parsed: ThoughtAction;
    try {
      const cleaned = raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned) as ThoughtAction;
    } catch {
      logger.warn("Research agent parse error", { raw });
      break;
    }

    logger.info("Research agent step", {
      step,
      action: parsed.action,
      thought: parsed.thought,
    });

    if (parsed.action === "finish" && parsed.answer) {
      return parsed.answer;
    }

    if (parsed.action === "search" && parsed.query) {
      const searchResult = await webSearch({
        query: parsed.query,
        count: 5,
      });

      const resultsText = searchResult.ok
        ? searchResult.summary
        : `Search failed: ${searchResult.summary}`;

      observations.push({ query: parsed.query, results: resultsText });
    }
  }

  // Forced synthesis after max steps
  if (observations.length === 0) {
    return `I couldn't find relevant information for: "${task}"`;
  }

  const synthesis = await callClaude(
    "You are a research synthesizer. Combine the following search results into a clear, concise answer.",
    `Task: ${task}\n\nSearch results:\n${observations
      .map((o) => `Query: "${o.query}"\n${o.results}`)
      .join("\n\n---\n\n")}`,
  );

  return synthesis;
}

export const researchAgent: SubAgentDefinition = {
  name: "research",
  description:
    "Multi-step research agent — iteratively searches the web and synthesizes a comprehensive answer",
  // This agent is handled specially by agentDelegate.ts (not via systemPrompt)
  systemPrompt: `You are a research planning agent. You plan research tasks by returning assistant.reply actions with synthesized findings.

RULES:
1. Output ONLY valid JSON: { "actions": [ ... ] }
2. Use only: assistant.reply
3. The reply should contain the synthesized research findings.

EXAMPLES:

User: "research TypeScript generics"
Output: { "actions": [{ "type": "assistant.reply", "args": { "text": "..." } }] }`,
};

/**
 * Entry point used by agentDelegate.ts when agent === "research".
 * Runs the ReAct loop and returns a plan with a single assistant.reply.
 */
export async function executeResearchAgent(
  message: string,
): Promise<{ actions: Array<{ type: string; args: Record<string, unknown> }> }> {
  logger.info("Research agent started", { message });
  const answer = await runResearchLoop(message);
  return {
    actions: [
      {
        type: "assistant.reply",
        args: { text: answer },
      },
    ],
  };
}
