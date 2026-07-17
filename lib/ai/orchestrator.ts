import { runEvaluatorAgent } from "@/lib/ai/agents/evaluator";
import { runKnowledgeAgent } from "@/lib/ai/agents/knowledge";
import { runResolutionAgent } from "@/lib/ai/agents/resolution";
import { runTriageAgent } from "@/lib/ai/agents/triage";
import { getLlmProvider } from "@/lib/ai/providers";
import { retrievePdfKnowledge } from "@/lib/ai/retrieval/pdf";
import { retrieveSimilarTickets } from "@/lib/ai/retrieval/tickets";
import type { AgentName, LlmProvider } from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";

async function recordStep(input: {
  runId: string;
  name: AgentName;
  start: number;
  status: "SUCCEEDED" | "FAILED";
  input?: unknown;
  output?: unknown;
  evidence?: unknown;
  error?: string;
}) {
  return prisma.agentStep.create({
    data: {
      runId: input.runId,
      name: input.name,
      status: input.status,
      input: input.input ? JSON.stringify(input.input) : null,
      output: input.output
        ? JSON.stringify(input.output)
        : input.error
          ? JSON.stringify({ error: input.error })
          : null,
      evidence: input.evidence ? JSON.stringify(input.evidence) : null,
      durationMs: Date.now() - input.start,
      finishedAt: new Date(),
    },
  });
}

async function executeStep<T>(input: {
  runId: string;
  name: AgentName;
  stepInput?: unknown;
  evidence?: unknown;
  operation: () => Promise<T>;
}): Promise<T> {
  const start = Date.now();
  try {
    const output = await input.operation();
    await recordStep({
      runId: input.runId,
      name: input.name,
      start,
      status: "SUCCEEDED",
      input: input.stepInput,
      output,
      evidence: input.evidence,
    });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown step failure";
    await recordStep({
      runId: input.runId,
      name: input.name,
      start,
      status: "FAILED",
      input: input.stepInput,
      evidence: input.evidence,
      error: message,
    });
    throw error;
  }
}

export async function runTicketAgents(input: {
  ticketId: string;
  triggeredById?: string;
  provider?: LlmProvider;
}) {
  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: input.ticketId },
  });

  const provider = input.provider ?? (await getLlmProvider());
  const model =
    provider.name.startsWith("ollama:")
      ? provider.name.replace("ollama:", "")
      : process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

  const run = await prisma.agentRun.create({
    data: {
      ticketId: ticket.id,
      status: "RUNNING",
      provider: provider.name,
      model,
      triggeredById: input.triggeredById,
    },
  });

  const started = Date.now();

  try {
    // Parallel retrieval
    const retrievalStart = Date.now();
    const [ticketResult, pdfResult] = await Promise.allSettled([
      retrieveSimilarTickets({
        ticketId: ticket.id,
        title: ticket.title,
        description: ticket.description,
      }),
      retrievePdfKnowledge({
        title: ticket.title,
        description: ticket.description,
      }),
    ]);

    await Promise.all([
      recordStep({
        runId: run.id,
        name: "retriever_db",
        start: retrievalStart,
        status: ticketResult.status === "fulfilled" ? "SUCCEEDED" : "FAILED",
        input: { ticketId: ticket.id },
        output:
          ticketResult.status === "fulfilled"
            ? { count: ticketResult.value.length }
            : undefined,
        evidence:
          ticketResult.status === "fulfilled" ? ticketResult.value : undefined,
        error:
          ticketResult.status === "rejected"
            ? ticketResult.reason instanceof Error
              ? ticketResult.reason.message
              : "Database retrieval failed"
            : undefined,
      }),
      recordStep({
        runId: run.id,
        name: "retriever_pdf",
        start: retrievalStart,
        status: pdfResult.status === "fulfilled" ? "SUCCEEDED" : "FAILED",
        input: { ticketId: ticket.id },
        output:
          pdfResult.status === "fulfilled"
            ? { count: pdfResult.value.length }
            : undefined,
        evidence: pdfResult.status === "fulfilled" ? pdfResult.value : undefined,
        error:
          pdfResult.status === "rejected"
            ? pdfResult.reason instanceof Error
              ? pdfResult.reason.message
              : "PDF retrieval failed"
            : undefined,
      }),
    ]);

    if (ticketResult.status === "rejected") throw ticketResult.reason;
    if (pdfResult.status === "rejected") throw pdfResult.reason;
    const similarTickets = ticketResult.value;
    const pdfHits = pdfResult.value;

    const triage = await executeStep({
      runId: run.id,
      name: "triage",
      stepInput: { title: ticket.title },
      evidence: similarTickets,
      operation: () =>
        runTriageAgent({
          provider,
          title: ticket.title,
          description: ticket.description,
          similarTickets,
        }),
    });

    const knowledge = await executeStep({
      runId: run.id,
      name: "knowledge",
      stepInput: { title: ticket.title },
      evidence: pdfHits,
      operation: () =>
        runKnowledgeAgent({
          provider,
          title: ticket.title,
          description: ticket.description,
          pdfHits,
        }),
    });

    const resolution = await executeStep({
      runId: run.id,
      name: "resolution",
      stepInput: { triage, knowledge },
      operation: () =>
        runResolutionAgent({
          provider,
          title: ticket.title,
          description: ticket.description,
          triage,
          knowledge,
        }),
    });

    const evaluation = await executeStep({
      runId: run.id,
      name: "evaluator",
      stepInput: { resolution },
      operation: () =>
        runEvaluatorAgent({
          provider,
          triage,
          knowledge,
          resolution,
        }),
    });

    const durationMs = Date.now() - started;
    const recommendation = await prisma.aiRecommendation.create({
      data: {
        runId: run.id,
        suggestedCategory: triage.category,
        suggestedPriority: triage.priority,
        draftResponse: resolution.draftResponse,
        recommendedActions: JSON.stringify(resolution.recommendedActions),
        confidence: Math.min(triage.confidence, resolution.confidence, evaluation.confidence),
        needsHumanReview: resolution.needsHumanReview || !evaluation.approved,
        citations: JSON.stringify(knowledge.citations),
      },
    });

    const reportBody = [
      `## AI brief for ticket ${ticket.title}`,
      "",
      `- Category suggestion: ${triage.category}`,
      `- Priority suggestion: ${triage.priority}`,
      `- Confidence: ${(recommendation.confidence * 100).toFixed(0)}%`,
      `- Evaluator: ${evaluation.approved ? "approved" : "needs revision"}`,
      "",
      "### Draft response",
      resolution.draftResponse,
      "",
      "### Recommended actions",
      ...resolution.recommendedActions.map((a) => `- ${a}`),
      "",
      "### Knowledge summary",
      knowledge.summary,
    ].join("\n");

    const report = await prisma.agentReport.create({
      data: {
        runId: run.id,
        title: `AI brief: ${ticket.title}`,
        body: reportBody,
        metrics: JSON.stringify({
          durationMs,
          provider: provider.name,
          model,
          similarTickets: similarTickets.length,
          pdfHits: pdfHits.length,
          evaluatorApproved: evaluation.approved,
          confidence: recommendation.confidence,
        }),
      },
    });

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        durationMs,
      },
    });

    await notify(
      "ai_run_completed",
      { id: ticket.id, title: ticket.title },
      {
        runId: run.id,
        recommendationId: recommendation.id,
        reportId: report.id,
        category: triage.category,
        priority: triage.priority,
        confidence: recommendation.confidence,
      },
    );

    await notify(
      "ai_report_generated",
      { id: ticket.id, title: ticket.title },
      {
        runId: run.id,
        reportId: report.id,
        title: report.title,
      },
    );

    return prisma.agentRun.findUniqueOrThrow({
      where: { id: run.id },
      include: {
        steps: { orderBy: { startedAt: "asc" } },
        recommendation: true,
        report: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent failure";
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: message,
        finishedAt: new Date(),
        durationMs: Date.now() - started,
      },
    });
    throw error;
  }
}
