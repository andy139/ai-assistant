/**
 * Splits text into overlapping chunks for RAG ingestion.
 * Chunk size ~500 chars, overlap ~100 chars.
 */
export interface TextChunk {
  text: string;
  index: number;
}

const CHUNK_SIZE = 500;
const OVERLAP = 100;

export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push({ text: chunk, index });
      index++;
    }
    if (end === text.length) break;
    start = end - OVERLAP;
  }

  return chunks;
}
