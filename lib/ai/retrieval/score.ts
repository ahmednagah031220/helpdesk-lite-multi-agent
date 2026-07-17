/**
 * Shared retrieval scoring: token overlap with IDF-style weighting and title boost.
 * Keeps ranking deterministic offline while behaving better than raw Jaccard.
 */

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "have",
  "has",
  "are",
  "was",
  "were",
  "been",
  "being",
  "into",
  "about",
  "your",
  "our",
  "their",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}

/**
 * Score a candidate against a query using BM25-lite over an optional corpus.
 * When corpusDocs is empty, falls back to weighted query-token coverage.
 */
export function scoreRelevance(input: {
  query: string;
  candidate: string;
  title?: string;
  corpusDocs?: string[];
}): number {
  const queryTokens = tokenize(input.query);
  if (queryTokens.length === 0) return 0;

  const candidateTokens = tokenize(
    `${input.title ? `${input.title} ${input.title} ` : ""}${input.candidate}`,
  );
  if (candidateTokens.length === 0) return 0;

  const candidateTf = termFrequency(candidateTokens);
  const corpus = input.corpusDocs?.length
    ? input.corpusDocs
    : [input.candidate];
  const docCount = Math.max(corpus.length, 1);
  const avgDl =
    corpus.reduce((sum, doc) => sum + tokenize(doc).length, 0) / docCount || 1;
  const dl = candidateTokens.length;

  const k1 = 1.2;
  const b = 0.75;
  let score = 0;

  const uniqueQuery = [...new Set(queryTokens)];
  for (const term of uniqueQuery) {
    const tf = candidateTf.get(term) ?? 0;
    if (tf === 0) continue;

    let df = 0;
    for (const doc of corpus) {
      if (tokenize(doc).includes(term)) df += 1;
    }
    const idf = Math.log(1 + (docCount - df + 0.5) / (df + 0.5));
    const denom = tf + k1 * (1 - b + (b * dl) / avgDl);
    score += idf * ((tf * (k1 + 1)) / denom);
  }

  // Normalize roughly into 0..1 for UI / downstream consumers
  const maxPossible = uniqueQuery.length * Math.log(1 + (docCount + 0.5) / 0.5);
  if (maxPossible <= 0) return 0;
  return Math.min(1, score / maxPossible);
}
