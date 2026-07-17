import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: {
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    role: "STAFF",
  },
  ticketFind: vi.fn(),
  runAgents: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: () => mocks.user,
  isErrorResponse: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: { ticket: { findUnique: mocks.ticketFind } },
}));
vi.mock("@/lib/ai/orchestrator", () => ({
  runTicketAgents: mocks.runAgents,
}));

import { POST } from "@/app/api/agents/run/route";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agents/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.role = "STAFF";
  mocks.ticketFind.mockResolvedValue({
    submitterId: "employee-1",
    assigneeId: "staff-1",
  });
  mocks.runAgents.mockResolvedValue({
    id: "run-1",
    status: "SUCCEEDED",
  });
});

describe("agent run API", () => {
  it("starts a run for a ticket visible to staff", async () => {
    const response = await POST(request({ ticketId: "ticket-1" }));

    expect(response.status).toBe(201);
    expect(mocks.runAgents).toHaveBeenCalledWith({
      ticketId: "ticket-1",
      triggeredById: "staff-1",
    });
  });

  it("allows staff to run an unassigned ticket", async () => {
    mocks.ticketFind.mockResolvedValue({
      submitterId: "employee-1",
      assigneeId: null,
    });
    const response = await POST(request({ ticketId: "ticket-1" }));

    expect(response.status).toBe(201);
  });

  it("forbids staff from running another staff member's ticket", async () => {
    mocks.ticketFind.mockResolvedValue({
      submitterId: "employee-1",
      assigneeId: "staff-2",
    });
    const response = await POST(request({ ticketId: "ticket-1" }));

    expect(response.status).toBe(403);
    expect(mocks.runAgents).not.toHaveBeenCalled();
  });

  it("forbids employees and returns missing tickets", async () => {
    mocks.user.role = "EMPLOYEE";
    const forbidden = await POST(request({ ticketId: "ticket-1" }));
    expect(forbidden.status).toBe(403);

    mocks.user.role = "MANAGER";
    mocks.ticketFind.mockResolvedValue(null);
    const missing = await POST(request({ ticketId: "missing" }));
    expect(missing.status).toBe(404);
  });

  it("validates required input", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
    expect(mocks.ticketFind).not.toHaveBeenCalled();
  });
});
