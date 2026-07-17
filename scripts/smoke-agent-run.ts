import "dotenv/config";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { runTicketAgents } from "@/lib/ai/orchestrator";
import { prisma } from "@/lib/db";

async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });
  if (!ticket) {
    throw new Error("No open ticket found — run npm run db:seed first");
  }

  console.log(`Running agents on ticket: ${ticket.title} (${ticket.id})`);
  const run = await runTicketAgents({
    ticketId: ticket.id,
    provider: createMockProvider(),
  });

  console.log(`Status: ${run.status}`);
  console.log(`Provider: ${run.provider}`);
  console.log(`Steps: ${run.steps.map((s) => s.name).join(" -> ")}`);
  console.log(`Category: ${run.recommendation?.suggestedCategory}`);
  console.log(`Priority: ${run.recommendation?.suggestedPriority}`);
  console.log(`Confidence: ${run.recommendation?.confidence}`);
  console.log(`Duration: ${run.durationMs}ms`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
