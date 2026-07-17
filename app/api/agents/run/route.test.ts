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
  ticketFind: vi.fn(),
  runAgents: vi.fn(),
  createPending: vi.fn(),
  enqueue: vi.fn(),
  runUpdate: vi.fn(),
  afterCallbacks: [] as Array<() => void | Promise<void>>,
}));

vi.mock("@/lib/session", () => ({
  requireSession: () => mocks.user,
  isErrorResponse: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: { findFirst: mocks.ticketFind },
    agentRun: { update: mocks.runUpdate },
  },
}));
vi.mock("@/lib/ai/orchestrator", () => ({
  runTicketAgents: mocks.runAgents,
  createPendingAgentRun: mocks.createPending,
}));
vi.mock("@/lib/queue/agent-queue", () => ({
  enqueueAgentRun: mocks.enqueue,
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (fn: () => void | Promise<void>) => {
      mocks.afterCallbacks.push(fn);
    },
  };
});

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
  mocks.afterCallbacks = [];
  mocks.user.role = "STAFF";
  mocks.ticketFind.mockResolvedValue({
    submitterId: "employee-1",
    assigneeId: "staff-1",
    orgId: "org-1",
  });
  mocks.runAgents.mockResolvedValue({
    id: "run-1",
    status: "SUCCEEDED",
  });
  mocks.createPending.mockResolvedValue({
    id: "run-pending",
    status: "PENDING",
  });
  mocks.enqueue.mockResolvedValue({ jobId: "job-1" });
  mocks.runUpdate.mockResolvedValue({});
});

describe("agent run API", () => {
  it("enqueues to Redis by default when the queue is available", async () => {
    const response = await POST(request({ ticketId: "ticket-1" }));

    expect(response.status).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalledWith({
      runId: "run-pending",
      ticketId: "ticket-1",
      triggeredById: "staff-1",
    });
    expect(mocks.afterCallbacks).toHaveLength(0);
    const body = await response.json();
    expect(body.queue).toBe("redis");
  });

  it("falls back to after() when Redis is unavailable", async () => {
    mocks.enqueue.mockResolvedValueOnce(null);
    const response = await POST(request({ ticketId: "ticket-1" }));

    expect(response.status).toBe(202);
    expect(mocks.afterCallbacks).toHaveLength(1);
    await mocks.afterCallbacks[0]();
    expect(mocks.runAgents).toHaveBeenCalledWith({
      ticketId: "ticket-1",
      triggeredById: "staff-1",
      existingRunId: "run-pending",
    });
  });

  it("runs synchronously when async is false", async () => {
    const response = await POST(
      request({ ticketId: "ticket-1", async: false }),
    );

    expect(response.status).toBe(201);
    expect(mocks.runAgents).toHaveBeenCalledWith({
      ticketId: "ticket-1",
      triggeredById: "staff-1",
    });
    expect(mocks.createPending).not.toHaveBeenCalled();
  });

  it("forbids staff from running another staff member's ticket", async () => {
    mocks.ticketFind.mockResolvedValue({
      submitterId: "employee-1",
      assigneeId: "staff-2",
      orgId: "org-1",
    });
    const response = await POST(request({ ticketId: "ticket-1" }));

    expect(response.status).toBe(403);
    expect(mocks.enqueue).not.toHaveBeenCalled();
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
