import { prisma } from "@/lib/db";
import type { RetrievalHit } from "@/lib/ai/types";

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

export async function retrieveSimilarTickets(input: {
  ticketId: string;
  title: string;
  description: string;
  limit?: number;
}): Promise<RetrievalHit[]> {
  const limit = input.limit ?? 5;
  const queryTokens = tokenize(`${input.title} ${input.description}`);

  const tickets = await prisma.ticket.findMany({
    where: { id: { not: input.ticketId } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
    },
  });

  return tickets
    .map((ticket) => {
      const score = scoreOverlap(
        queryTokens,
        `${ticket.title} ${ticket.description} ${ticket.category}`,
      );
      return {
        id: ticket.id,
        title: `[${ticket.category}] ${ticket.title}`,
        excerpt: ticket.description.slice(0, 240),
        score,
        sourceType: "ticket" as const,
        sourceRef: ticket.id,
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
