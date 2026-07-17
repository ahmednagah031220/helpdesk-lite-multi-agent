import { prisma } from "@/lib/db";
import type { RetrievalHit } from "@/lib/ai/types";
import { scoreRelevance } from "@/lib/ai/retrieval/score";

export async function retrieveSimilarTickets(input: {
  ticketId: string;
  title: string;
  description: string;
  orgId: string;
  limit?: number;
}): Promise<RetrievalHit[]> {
  const limit = input.limit ?? 5;
  const query = `${input.title} ${input.description}`;

  const tickets = await prisma.ticket.findMany({
    where: {
      id: { not: input.ticketId },
      orgId: input.orgId,
    },
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

  const corpusDocs = tickets.map(
    (ticket) => `${ticket.title} ${ticket.description} ${ticket.category}`,
  );

  return tickets
    .map((ticket, index) => {
      const score = scoreRelevance({
        query,
        candidate: corpusDocs[index],
        title: ticket.title,
        corpusDocs,
      });
      return {
        id: ticket.id,
        title: `[${ticket.category}] ${ticket.title}`,
        excerpt: ticket.description.slice(0, 240),
        score,
        sourceType: "ticket" as const,
        sourceRef: ticket.id,
      };
    })
    .filter((hit) => hit.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
