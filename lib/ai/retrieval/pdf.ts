import { prisma } from "@/lib/db";
import type { RetrievalHit } from "@/lib/ai/types";
import { chunkText } from "@/lib/ai/retrieval/chunk";

export { chunkText };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function scoreOverlap(queryTokens: string[], candidate: string): number {
  if (queryTokens.length === 0) return 0;
  const set = new Set(tokenize(candidate));
  let hits = 0;
  for (const token of queryTokens) {
    if (set.has(token)) hits += 1;
  }
  return hits / queryTokens.length;
}

export async function retrievePdfKnowledge(input: {
  title: string;
  description: string;
  limit?: number;
}): Promise<RetrievalHit[]> {
  const limit = input.limit ?? 5;
  const queryTokens = tokenize(`${input.title} ${input.description}`);

  const chunks = await prisma.knowledgeChunk.findMany({
    take: 200,
    include: { document: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return chunks
    .map((chunk) => {
      const score = scoreOverlap(queryTokens, chunk.content);
      return {
        id: chunk.id,
        title: chunk.document.title,
        excerpt: chunk.content.slice(0, 280),
        score,
        sourceType: "pdf" as const,
        sourceRef: chunk.document.id,
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
