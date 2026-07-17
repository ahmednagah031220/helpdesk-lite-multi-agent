import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: {
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    role: "STAFF",
    orgId: "org-1",
  },
  recommendationFind: vi.fn(),
  recommendationUpdate: vi.fn(),
  ticketUpdate: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: () => mocks.user,
  isErrorResponse: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    aiRecommendation: {
      findUnique: mocks.recommendationFind,
      update: mocks.recommendationUpdate,
    },
    ticket: { update: mocks.ticketUpdate },
  },
}));
vi.mock("@/lib/notifications", () => ({
  notify: mocks.notify,
}));

import { PATCH } from "@/app/api/agents/recommendations/[id]/route";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agents/recommendations/rec-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "rec-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.role = "STAFF";
  mocks.recommendationFind.mockResolvedValue({
    id: "rec-1",
    decision: "PENDING",
    suggestedCategory: "IT",
    suggestedPriority: "HIGH",
    run: {
      ticketId: "ticket-1",
      ticket: {
        id: "ticket-1",
        title: "VPN access",
        status: "OPEN",
        submitterId: "employee-1",
        assigneeId: "staff-1",
      },
    },
  });
  mocks.recommendationUpdate.mockResolvedValue({
    id: "rec-1",
    decision: "APPROVED",
  });
  mocks.ticketUpdate.mockResolvedValue({});
  mocks.notify.mockResolvedValue(undefined);
});

describe("recommendation decision API", () => {
  it("allows staff approval and only applies safe metadata", async () => {
    const response = await PATCH(
      request({ decision: "APPROVED", note: "Looks good" }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.ticketUpdate).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: {
        category: "IT",
        priority: "HIGH",
      },
    });
    const updateData = mocks.ticketUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("status");
    expect(updateData).not.toHaveProperty("assigneeId");
    expect(mocks.notify).toHaveBeenCalledWith(
      "ai_recommendation_approved",
      expect.objectContaining({ id: "ticket-1" }),
      expect.objectContaining({ recommendationId: "rec-1" }),
    );
  });

  it("does not mutate the ticket when rejected", async () => {
    mocks.recommendationUpdate.mockResolvedValue({
      id: "rec-1",
      decision: "REJECTED",
    });
    const response = await PATCH(
      request({ decision: "REJECTED", note: "Wrong category" }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(
      "ai_recommendation_rejected",
      expect.anything(),
      expect.anything(),
    );
  });

  it("can approve without applying suggested metadata", async () => {
    const response = await PATCH(
      request({ decision: "APPROVED", applyCategory: false }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.recommendationUpdate).toHaveBeenCalledOnce();
    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
  });

  it("rejects a repeated decision", async () => {
    mocks.recommendationFind.mockResolvedValue({
      decision: "APPROVED",
      run: {
        ticketId: "ticket-1",
        ticket: {
          id: "ticket-1",
          title: "VPN access",
          submitterId: "employee-1",
          assigneeId: "staff-1",
        },
      },
    });
    const response = await PATCH(
      request({ decision: "REJECTED" }),
      context,
    );

    expect(response.status).toBe(409);
    expect(mocks.recommendationUpdate).not.toHaveBeenCalled();
    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
  });

  it("forbids staff from deciding another staff member's ticket", async () => {
    mocks.recommendationFind.mockResolvedValue({
      decision: "PENDING",
      run: {
        ticketId: "ticket-1",
        ticket: {
          id: "ticket-1",
          title: "Private ticket",
          submitterId: "employee-1",
          assigneeId: "staff-2",
        },
      },
    });
    const response = await PATCH(
      request({ decision: "APPROVED" }),
      context,
    );

    expect(response.status).toBe(403);
    expect(mocks.recommendationUpdate).not.toHaveBeenCalled();
  });

  it("forbids employees", async () => {
    mocks.user.role = "EMPLOYEE";
    const response = await PATCH(
      request({ decision: "APPROVED" }),
      context,
    );

    expect(response.status).toBe(403);
    expect(mocks.recommendationFind).not.toHaveBeenCalled();
  });
});
