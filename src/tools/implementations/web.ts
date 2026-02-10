import { config } from "../../config/index.js";
import { callClaude } from "../../agent/claudeClient.js";
import type { WebSearchArgs, WebSummarizeArgs } from "../schemas/web.js";
import type { ToolResult } from "../registry.js";

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: { results: BraveWebResult[] };
}

export async function webSearch(args: WebSearchArgs): Promise<ToolResult> {
  const apiKey = config.brave.apiKey;
  if (!apiKey) {
    return { ok: false, data: null, summary: "Brave Search API key not configured" };
  }

  const count = args.count ?? 5;
  const params = new URLSearchParams({ q: args.query, count: String(count) });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { "X-Subscription-Token": apiKey },
  });

  if (!res.ok) {
    return { ok: false, data: null, summary: `Brave Search API returned ${res.status}` };
  }

  const json = (await res.json()) as BraveSearchResponse;
  const results = (json.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));

  if (results.length === 0) {
    return { ok: true, data: [], summary: `No results found for "${args.query}"` };
  }

  const summary = results
    .map((r, i) => `${i + 1}. ${r.title} — ${r.url}`)
    .join("\n");

  return { ok: true, data: results, summary };
}

const MAX_PAGE_CHARS = 10_000;

export async function webSummarize(args: WebSummarizeArgs): Promise<ToolResult> {
  let html: string;
  try {
    const res = await fetch(args.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AssistantBot/1.0)" },
    });
    if (!res.ok) {
      return { ok: false, data: null, summary: `Failed to fetch URL: HTTP ${res.status}` };
    }
    html = await res.text();
  } catch (err) {
    return { ok: false, data: null, summary: `Failed to fetch URL: ${(err as Error).message}` };
  }

  // Strip HTML tags and truncate
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_PAGE_CHARS);

  if (!text) {
    return { ok: false, data: null, summary: "Page returned no readable text content" };
  }

  const summary = await callClaude(
    "You are a concise summarizer. Summarize the following web page content in a few paragraphs. Focus on the key points.",
    text,
  );

  return { ok: true, data: { url: args.url, summary }, summary };
}
