import "dotenv/config";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { runTicketAgents } from "@/lib/ai/orchestrator";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";

/**
 * Thin end-to-end smoke (no browser): seed data → agent run → notify sinks.
 */
async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });
  if (!ticket) {
    throw new Error("No open ticket — run npm run db:seed first");
  }

  console.log(`1) Running agents on: ${ticket.title}`);
  const run = await runTicketAgents({
    ticketId: ticket.id,
    provider: createMockProvider(),
  });
  if (run.status !== "SUCCEEDED" || !run.recommendation) {
    throw new Error(`Agent run did not succeed: ${run.status} ${run.error}`);
  }
  console.log(
    `   OK · ${run.steps.length} steps · ${run.recommendation.suggestedCategory}/${run.recommendation.suggestedPriority}`,
  );

  console.log("2) Emitting notification (email + webhook if configured)");
  const delivery = await notify(
    "ai_run_completed",
    { id: ticket.id, title: ticket.title },
    {
      runId: run.id,
      recommendationId: run.recommendation.id,
      category: run.recommendation.suggestedCategory,
      priority: run.recommendation.suggestedPriority,
    },
  );
  console.log(`   audit logged · email=${delivery.delivery.email?.sent ?? false} · webhook=${delivery.delivery.webhook?.sent ?? false}`);

  console.log("3) Manager metrics snapshot");
  const [runs, succeeded] = await Promise.all([
    prisma.agentRun.count(),
    prisma.agentRun.count({ where: { status: "SUCCEEDED" } }),
  ]);
  console.log(`   runs=${runs} succeeded=${succeeded}`);

  console.log("\nE2E smoke passed.");
  console.log("Mailpit:  http://127.0.0.1:8025");
  console.log("Webhook:  http://127.0.0.1:8089/");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
