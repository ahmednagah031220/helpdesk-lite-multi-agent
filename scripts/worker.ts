import "dotenv/config";
import { runTicketAgents } from "@/lib/ai/orchestrator";
import { createAgentWorker } from "@/lib/queue/agent-queue";

console.log("[worker] starting agent-runs worker…");

const worker = createAgentWorker(async (job) => {
  const { runId, ticketId, triggeredById } = job.data;
  console.log(`[worker] job ${job.id} run=${runId} ticket=${ticketId}`);
  await runTicketAgents({
    ticketId,
    triggeredById,
    existingRunId: runId,
  });
});

worker.on("completed", (job) => {
  console.log(`[worker] completed ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] failed ${job?.id}:`, error.message);
});

async function shutdown() {
  console.log("[worker] shutting down…");
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
