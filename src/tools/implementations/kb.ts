import { db } from "../../store/db.js";
import { chunkText } from "../../rag/chunker.js";
import { computeTF } from "../../rag/vectorize.js";
import { retrieveChunks } from "../../rag/retriever.js";
import type { KbIngestArgs, KbSearchArgs, KbListArgs } from "../schemas/kb.js";
import type { ToolResult } from "../registry.js";

export async function kbIngest(args: KbIngestArgs): Promise<ToolResult> {
  const chunks = chunkText(args.content);

  const doc = await db.document.create({
    data: {
      title: args.title,
      source: args.source,
      content: args.content,
      chunks: {
        create: chunks.map((chunk) => ({
          text: chunk.text,
          tfJson: JSON.stringify(computeTF(chunk.text)),
          chunkIndex: chunk.index,
        })),
      },
    },
  });

  return {
    ok: true,
    data: { id: doc.id, title: doc.title, chunkCount: chunks.length },
    summary: `Ingested "${args.title}" into knowledge base (${chunks.length} chunks)`,
  };
}

export async function kbSearch(args: KbSearchArgs): Promise<ToolResult> {
  const topK = args.topK ?? 3;
  const results = await retrieveChunks(args.query, topK);

  if (results.length === 0) {
    return {
      ok: true,
      data: [],
      summary: `No knowledge base results for "${args.query}"`,
    };
  }

  const formatted = results
    .map(
      (r, i) =>
        `[${i + 1}] "${r.documentTitle}" (score: ${r.score.toFixed(3)}):\n${r.text.slice(0, 300)}`,
    )
    .join("\n\n---\n\n");

  return {
    ok: true,
    data: results,
    summary: `Knowledge base results for "${args.query}":\n\n${formatted}`,
  };
}

export async function kbList(args: KbListArgs): Promise<ToolResult> {
  const docs = await db.document.findMany({
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 20,
    include: { _count: { select: { chunks: true } } },
  });

  if (docs.length === 0) {
    return { ok: true, data: [], summary: "Knowledge base is empty" };
  }

  const list = docs
    .map((d) => `• "${d.title}" [${d.source}] — ${d._count.chunks} chunks`)
    .join("\n");

  return {
    ok: true,
    data: docs.map((d) => ({ id: d.id, title: d.title, source: d.source, chunks: d._count.chunks })),
    summary: `Knowledge base documents:\n\n${list}`,
  };
}
