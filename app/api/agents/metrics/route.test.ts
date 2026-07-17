import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: {
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    role: "STAFF",
    orgId: "org-1",
  },
  runCount: vi.fn(),
  recommendationCount: vi.fn(),
  reportFindMany: vi.fn(),
  runAggregate: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: () => mocks.user,
  isErrorResponse: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentRun: {
      count: mocks.runCount,
      aggregate: mocks.runAggregate,
    },
    aiRecommendation: { count: mocks.recommendationCount },
    agentReport: { findMany: mocks.reportFindMany },
  },
}));

import { GET } from "@/app/api/agents/metrics/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.role = "STAFF";
  mocks.runCount
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(3)
    .mockResolvedValueOnce(1);
  mocks.recommendationCount.mockResolvedValue(2);
  mocks.reportFindMany.mockResolvedValue([{ id: "report-1" }]);
  mocks.runAggregate.mockResolvedValue({ _avg: { durationMs: 125 } });
});

describe("agent metrics API", () => {
  it("returns role-filtered reliability metrics", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      totalRuns: 4,
      succeeded: 3,
      failed: 1,
      successRate: 0.75,
      pendingRecommendations: 2,
      avgDurationMs: 125,
    });
    expect(mocks.runCount.mock.calls[0][0].where).toEqual({
      ticket: {
        is: {
          orgId: "org-1",
          OR: [{ assigneeId: "staff-1" }, { assigneeId: null }],
        },
      },
    });
  });

  it("forbids employees", async () => {
    mocks.user.role = "EMPLOYEE";
    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.runCount).not.toHaveBeenCalled();
  });
});
