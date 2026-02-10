import { config } from "../../config/index.js";
import type { WebSearchArgs } from "../schemas/web.js";
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
