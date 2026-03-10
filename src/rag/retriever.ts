/**
 * Retrieves the most relevant document chunks for a query
 * using cosine similarity over TF-IDF vectors stored in SQLite.
 */
import { db } from "../store/db.js";
import { computeTF, cosineSimilarity } from "./vectorize.js";

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  text: string;
  score: number;
  chunkIndex: number;
}

/**
 * Find the top-k most relevant chunks for a query string.
 */
export async function retrieveChunks(
  query: string,
  topK = 3,
): Promise<RetrievedChunk[]> {
  const queryTF = computeTF(query);

  const chunks = await db.documentChunk.findMany({
    include: { document: { select: { title: true } } },
  });

  const scored = chunks.map((chunk) => {
    const chunkTF = JSON.parse(chunk.tfJson) as Record<string, number>;
    const score = cosineSimilarity(queryTF, chunkTF);
    return {
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      text: chunk.text,
      score,
      chunkIndex: chunk.chunkIndex,
    };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Format retrieved chunks as a context block for injection into prompts.
 */
export function formatRagContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const sections = chunks.map(
    (c, i) =>
      `[${i + 1}] From "${c.documentTitle}":\n${c.text}`,
  );
  return `KNOWLEDGE BASE CONTEXT (use this to answer questions):\n\n${sections.join("\n\n---\n\n")}`;
}
