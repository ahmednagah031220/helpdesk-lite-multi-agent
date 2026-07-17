import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(),
  chunkFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: { findMany: mocks.ticketFindMany },
    knowledgeChunk: { findMany: mocks.chunkFindMany },
  },
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
      limit: 2,
    });

    expect(hits.map((hit) => hit.id)).toEqual(["strong", "weak"]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { not: "current" } },
      }),
    );
  });

  it("ranks knowledge chunks and removes irrelevant chunks", async () => {
    mocks.chunkFindMany.mockResolvedValue([
      {
        id: "network",
        content: "Restart the wireless adapter when office wifi disconnects.",
        createdAt: new Date(),
        document: { id: "handbook", title: "Support Handbook" },
      },
      {
        id: "payroll",
        content: "Payslip and leave balance requests go to HR.",
        createdAt: new Date(),
        document: { id: "handbook", title: "Support Handbook" },
      },
      {
        id: "strong-network",
        content:
          "For office wifi laptop disconnect problems restart the wifi adapter.",
        createdAt: new Date(),
        document: { id: "network-guide", title: "Network Guide" },
      },
    ]);

    const hits = await retrievePdfKnowledge({
      title: "Office WiFi disconnect",
      description: "Laptop wifi adapter disconnect problem",
      limit: 5,
    });

    expect(hits.map((hit) => hit.id)).toEqual([
      "strong-network",
      "network",
    ]);
    expect(hits.every((hit) => hit.sourceType === "pdf")).toBe(true);
    expect(hits[0].sourceRef).toBe("network-guide");
  });
});
