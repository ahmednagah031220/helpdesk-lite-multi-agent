import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retrieveTickets: vi.fn(),
  retrieveKnowledge: vi.fn(),
  triage: vi.fn(),
  knowledge: vi.fn(),
  resolution: vi.fn(),
  evaluator: vi.fn(),
  ticketFind: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  runFind: vi.fn(),
  stepCreate: vi.fn(),
  recommendationCreate: vi.fn(),
  reportCreate: vi.fn(),
  notificationCreate: vi.fn(),
}));

vi.mock("@/lib/ai/retrieval/tickets", () => ({
  retrieveSimilarTickets: mocks.retrieveTickets,
}));
vi.mock("@/lib/ai/retrieval/pdf", () => ({
  retrievePdfKnowledge: mocks.retrieveKnowledge,
}));
vi.mock("@/lib/ai/agents/triage", () => ({
  runTriageAgent: mocks.triage,
}));
vi.mock("@/lib/ai/agents/knowledge", () => ({
  runKnowledgeAgent: mocks.knowledge,
}));
vi.mock("@/lib/ai/agents/resolution", () => ({
  runResolutionAgent: mocks.resolution,
}));
vi.mock("@/lib/ai/agents/evaluator", () => ({
  runEvaluatorAgent: mocks.evaluator,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: { findUniqueOrThrow: mocks.ticketFind },
    agentRun: {
      create: mocks.runCreate,
      update: mocks.runUpdate,
      findUniqueOrThrow: mocks.runFind,
    },
    agentStep: { create: mocks.stepCreate },
    aiRecommendation: { create: mocks.recommendationCreate },
    agentReport: { create: mocks.reportCreate },
    notificationLog: { create: mocks.notificationCreate },
  },
}));

import { runTicketAgents } from "@/lib/ai/orchestrator";

const provider = {
  name: "mock",
  complete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ticketFind.mockResolvedValue({
    id: "ticket-1",
    title: "WiFi issue",
    description: "Office wifi disconnects",
  });
  mocks.runCreate.mockResolvedValue({ id: "run-1" });
  mocks.runUpdate.mockResolvedValue({});
  mocks.stepCreate.mockResolvedValue({});
  mocks.retrieveTickets.mockResolvedValue([
    {
      id: "old-1",
      title: "Old WiFi issue",
      excerpt: "fixed adapter",
      score: 0.8,
      sourceType: "ticket",
    },
  ]);
  mocks.retrieveKnowledge.mockResolvedValue([
    {
      id: "chunk-1",
      title: "Handbook",
      excerpt: "restart adapter",
      score: 0.9,
      sourceType: "pdf",
    },
  ]);
  mocks.triage.mockResolvedValue({
    category: "IT",
    priority: "MEDIUM",
    confidence: 0.9,
    rationale: "network",
    tags: ["wifi"],
  });
  mocks.knowledge.mockResolvedValue({
    relevant: true,
    summary: "Restart adapter",
    citations: [
      { documentTitle: "Handbook", excerpt: "restart adapter", score: 0.9 },
    ],
    suggestedSteps: ["Restart adapter"],
  });
  mocks.resolution.mockResolvedValue({
    draftResponse: "Please restart the adapter.",
    recommendedActions: ["Send response"],
    needsHumanReview: true,
    confidence: 0.85,
  });
  mocks.evaluator.mockResolvedValue({
    approved: true,
    issues: [],
    confidence: 0.95,
    notes: "Safe",
  });
  mocks.recommendationCreate.mockResolvedValue({
    id: "rec-1",
    confidence: 0.85,
  });
  mocks.runFind.mockResolvedValue({
    id: "run-1",
    status: "SUCCEEDED",
    steps: [],
    recommendation: { id: "rec-1" },
    report: { id: "report-1" },
  });
});

describe("runTicketAgents", () => {
  it("executes the real orchestration contract and persists all outputs", async () => {
    const result = await runTicketAgents({
      ticketId: "ticket-1",
      triggeredById: "staff-1",
      provider,
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(mocks.retrieveTickets).toHaveBeenCalledOnce();
    expect(mocks.retrieveKnowledge).toHaveBeenCalledOnce();
    expect(mocks.triage).toHaveBeenCalledAfter(mocks.retrieveTickets);
    expect(mocks.triage).toHaveBeenCalledAfter(mocks.retrieveKnowledge);
    expect(mocks.resolution).toHaveBeenCalledAfter(mocks.triage);
    expect(mocks.resolution).toHaveBeenCalledAfter(mocks.knowledge);
    expect(mocks.evaluator).toHaveBeenCalledAfter(mocks.resolution);

    expect(mocks.stepCreate.mock.calls.map(([arg]) => arg.data.name)).toEqual([
      "retriever_db",
      "retriever_pdf",
      "triage",
      "knowledge",
      "resolution",
      "evaluator",
    ]);
    expect(mocks.recommendationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        runId: "run-1",
        suggestedCategory: "IT",
        suggestedPriority: "MEDIUM",
        needsHumanReview: true,
      }),
    });
    expect(mocks.reportCreate).toHaveBeenCalledOnce();
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: "ai_run_completed",
        ticketId: "ticket-1",
      }),
    });
    expect(mocks.runUpdate).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "SUCCEEDED" }),
    });
  });

  it("marks the run failed when an agent throws", async () => {
    mocks.triage.mockRejectedValueOnce(new Error("invalid model output"));

    await expect(
      runTicketAgents({ ticketId: "ticket-1", provider }),
    ).rejects.toThrow("invalid model output");

    expect(mocks.recommendationCreate).not.toHaveBeenCalled();
    expect(mocks.stepCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "triage",
        status: "FAILED",
        output: JSON.stringify({ error: "invalid model output" }),
      }),
    });
    expect(mocks.runUpdate).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "FAILED",
        error: "invalid model output",
      }),
    });
  });
});
