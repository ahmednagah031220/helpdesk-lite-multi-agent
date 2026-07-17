export const EMBEDDING_DIMENSIONS = 384;

/** Deterministic local embedding for offline / CI when Ollama embeddings are unavailable. */
export function localEmbed(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1;
    vec[(idx + 1) % dimensions] += 0.5;
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function toPgVectorLiteral(values: number[]): string {
  return `[${values.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
}

export async function embedText(text: string): Promise<{
  vector: number[];
  provider: string;
}> {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(
    /\/$/,
    "",
  );
  const model = process.env.EMBEDDING_MODEL ?? "nomic-embed-text";

  if (process.env.EMBEDDING_PROVIDER === "local") {
    return { vector: localEmbed(text), provider: "local" };
  }

  try {
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`embeddings HTTP ${response.status}`);
    }
    const data = (await response.json()) as { embedding?: number[] };
    if (!data.embedding?.length) {
      throw new Error("empty embedding");
    }
    // Normalize / pad / trim to fixed dimensions for pgvector column
    const raw = data.embedding;
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    for (let i = 0; i < Math.min(raw.length, EMBEDDING_DIMENSIONS); i += 1) {
      vector[i] = raw[i];
    }
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
    return {
      vector: vector.map((v) => v / norm),
      provider: `ollama:${model}`,
    };
  } catch {
    return { vector: localEmbed(text), provider: "local-fallback" };
  }
}
