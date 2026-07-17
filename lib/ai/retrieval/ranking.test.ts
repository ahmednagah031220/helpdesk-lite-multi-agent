import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(),
  chunkFindMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: { findMany: mocks.ticketFindMany },
    knowledgeChunk: { findMany: mocks.chunkFindMany },
    $queryRawUnsafe: mocks.queryRaw,
  },
}));

vi.mock("@/lib/ai/embeddings", () => ({
  embedText: async () => ({
    vector: new Array(384).fill(0),
    provider: "local",
  }),
  toPgVectorLiteral: () => "[" + new Array(384).fill(0).join(",") + "]",
}));

import { retrievePdfKnowledge } from "@/lib/ai/retrieval/pdf";
import { retrieveSimilarTickets } from "@/lib/ai/retrieval/tickets";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("retrieval ranking", () => {
  it("ranks historical tickets by keyword overlap and respects limit", async () => {
    mocks.ticketFindMany.mockResolvedValue([
      {
        id: "weak",
        title: "Laptop request",
        description: "Request a replacement device",
        category: "IT",
        status: "CLOSED",
      },
      {
        id: "strong",
        title: "Office WiFi laptop disconnect",
        description: "WiFi disconnects from the laptop every few minutes",
        category: "IT",
        status: "RESOLVED",
      },
      {
        id: "none",
        title: "Payslip",
        description: "Missing payroll record",
        category: "HR",
        status: "CLOSED",
      },
    ]);

    const hits = await retrieveSimilarTickets({
      ticketId: "current",
      title: "WiFi laptop disconnect",
      description: "Office WiFi keeps disconnecting",
      orgId: "org-1",
      limit: 2,
    });

    expect(hits.map((hit) => hit.id)).toEqual(["strong", "weak"]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { not: "current" }, orgId: "org-1" },
      }),
    );
  });

  it("ranks knowledge chunks with hybrid scores and removes noise", async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: "strong-network",
        content:
          "For office wifi laptop disconnect problems restart the wifi adapter.",
        documentId: "network-guide",
        title: "Network Guide",
        vectorScore: 0.9,
      },
      {
        id: "network",
        content: "Restart the wireless adapter when office wifi disconnects.",
        documentId: "handbook",
        title: "Support Handbook",
        vectorScore: 0.7,
      },
      {
        id: "payroll",
        content: "Payslip and leave balance requests go to HR.",
        documentId: "handbook",
        title: "Support Handbook",
        vectorScore: 0.05,
      },
    ]);

    const hits = await retrievePdfKnowledge({
      title: "Office WiFi disconnect",
      description: "Laptop wifi adapter disconnect problem",
      orgId: "org-1",
      limit: 5,
    });

    expect(hits[0].id).toBe("strong-network");
    expect(hits.every((hit) => hit.sourceType === "pdf")).toBe(true);
    expect(hits[0].sourceRef).toBe("network-guide");
    expect(hits[0].score).toBeGreaterThan(hits[hits.length - 1].score);
  });
});
