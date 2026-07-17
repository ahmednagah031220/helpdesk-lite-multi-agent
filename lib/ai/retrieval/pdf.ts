import { prisma } from "@/lib/db";
import type { RetrievalHit } from "@/lib/ai/types";
import { chunkText } from "@/lib/ai/retrieval/chunk";
import { scoreRelevance } from "@/lib/ai/retrieval/score";
import {
  embedText,
  toPgVectorLiteral,
} from "@/lib/ai/embeddings";

export { chunkText };

type ChunkRow = {
  id: string;
  content: string;
  documentId: string;
  title: string;
  vectorScore: number | null;
};

/**
 * Hybrid retrieval: BM25-lite lexical score blended with pgvector cosine similarity.
 * Scoped to a single organization.
 */
export async function retrievePdfKnowledge(input: {
  title: string;
  description: string;
  orgId: string;
  limit?: number;
}): Promise<RetrievalHit[]> {
  const limit = input.limit ?? 5;
  const query = `${input.title} ${input.description}`;
  const { vector } = await embedText(query);
  const vectorLiteral = toPgVectorLiteral(vector);

  let vectorHits: ChunkRow[] = [];
  try {
    vectorHits = await prisma.$queryRawUnsafe<ChunkRow[]>(
      `
      SELECT c.id, c.content, c."documentId", d.title,
             CASE WHEN c.embedding IS NULL THEN NULL
                  ELSE (1 - (c.embedding <=> $1::vector))::float8
             END AS "vectorScore"
      FROM "KnowledgeChunk" c
      INNER JOIN "KnowledgeDocument" d ON d.id = c."documentId"
      WHERE d."orgId" = $2
      ORDER BY c.embedding <=> $1::vector NULLS LAST
      LIMIT 50
      `,
      vectorLiteral,
      input.orgId,
    );
  } catch {
    // Fallback if pgvector unavailable
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { document: { orgId: input.orgId } },
      take: 200,
      include: { document: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    vectorHits = chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      documentId: chunk.document.id,
      title: chunk.document.title,
      vectorScore: null,
    }));
  }

  const corpusDocs = vectorHits.map((chunk) => chunk.content);

  return vectorHits
    .map((chunk, index) => {
      const lexical = scoreRelevance({
        query,
        candidate: corpusDocs[index],
        title: chunk.title,
        corpusDocs,
      });
      const semantic = chunk.vectorScore ?? 0;
      const score =
        chunk.vectorScore == null
          ? lexical
          : 0.45 * lexical + 0.55 * Math.max(0, semantic);
      return {
        id: chunk.id,
        title: chunk.title,
        excerpt: chunk.content.slice(0, 280),
        score,
        sourceType: "pdf" as const,
        sourceRef: chunk.documentId,
      };
    })
    .filter((hit) => hit.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function persistChunkEmbedding(chunkId: string, content: string) {
  const { vector } = await embedText(content);
  const literal = toPgVectorLiteral(vector);
  await prisma.$executeRawUnsafe(
    `UPDATE "KnowledgeChunk" SET embedding = $1::vector WHERE id = $2`,
    literal,
    chunkId,
  );
}
