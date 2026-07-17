import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: {
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    role: "STAFF",
  },
  runFind: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: () => mocks.user,
  isErrorResponse: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: { agentRun: { findUnique: mocks.runFind } },
}));

import { GET } from "@/app/api/agents/runs/[id]/route";

const request = new NextRequest("http://localhost/api/agents/runs/run-1");
const context = { params: Promise.resolve({ id: "run-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.role = "STAFF";
  mocks.runFind.mockResolvedValue({
    id: "run-1",
    status: "SUCCEEDED",
    steps: [],
    recommendation: null,
    report: null,
    ticket: {
      id: "ticket-1",
      title: "WiFi",
      category: "IT",
      status: "OPEN",
      submitterId: "employee-1",
      assigneeId: "staff-1",
    },
  });
});

describe("agent run detail API", () => {
  it("returns visible run details", async () => {
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "run-1",
      ticket: { id: "ticket-1" },
    });
  });

  it("hides another staff member's run", async () => {
    mocks.runFind.mockResolvedValue({
      id: "run-1",
      ticket: {
        id: "ticket-1",
        submitterId: "employee-1",
        assigneeId: "staff-2",
      },
    });
    const response = await GET(request, context);

    expect(response.status).toBe(403);
  });

  it("returns 404 for a missing run", async () => {
    mocks.runFind.mockResolvedValue(null);
    const response = await GET(request, context);
    expect(response.status).toBe(404);
  });
});
