/**
 * TF-IDF style term frequency vectorization for semantic similarity.
 * No external API needed — runs entirely in-process.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "this", "that", "are", "was",
  "be", "been", "has", "have", "had", "do", "did", "will", "would", "can",
  "could", "not", "as", "if", "so", "its", "our", "your", "their", "my",
  "we", "i", "you", "he", "she", "they", "what", "which", "who", "how",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function computeTF(text: string): Record<string, number> {
  const tokens = tokenize(text);
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] ?? 0) + 1;
  }
  // Normalize by total token count
  const total = tokens.length || 1;
  for (const t in freq) {
    freq[t] = freq[t] / total;
  }
  return freq;
}

export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const term in a) {
    magA += a[term] ** 2;
    if (b[term] !== undefined) dot += a[term] * b[term];
  }
  for (const term in b) {
    magB += b[term] ** 2;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
