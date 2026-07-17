import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: {
    id: "employee-1",
    name: "Alice",
    email: "employee@example.com",
    role: "EMPLOYEE",
    orgId: "org-1",
  },
  findMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: () => mocks.user,
  isErrorResponse: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: {
      findMany: mocks.findMany,
      create: mocks.create,
    },
  },
}));

import { GET, POST } from "@/app/api/tickets/route";

function getRequest(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/tickets${query}`);
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.role = "EMPLOYEE";
  mocks.user.id = "employee-1";
  mocks.findMany.mockResolvedValue([{ id: "t1", title: "WiFi" }]);
  mocks.create.mockResolvedValue({
    id: "t2",
    title: "VPN access",
    category: "IT",
  });
});

describe("tickets API", () => {
  it("lists tickets filtered to the employee submitter", async () => {
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submitterId: "employee-1",
          orgId: "org-1",
        }),
      }),
    );
  });

  it("applies optional status and category filters", async () => {
    mocks.user.role = "MANAGER";
    const response = await GET(getRequest("?status=OPEN&category=IT"));
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          status: "OPEN",
          category: "IT",
        }),
      }),
    );
  });

  it("creates a ticket for the authenticated user", async () => {
    const response = await POST(
      postRequest({
        title: "VPN access",
        description: "Need contractor VPN",
        category: "IT",
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "VPN access",
          category: "IT",
          submitterId: "employee-1",
          orgId: "org-1",
        }),
      }),
    );
  });

  it("rejects incomplete create payloads", async () => {
    const response = await POST(postRequest({ title: "Only title" }));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects invalid categories", async () => {
    const response = await POST(
      postRequest({
        title: "X",
        description: "Y",
        category: "FINANCE",
      }),
    );
    expect(response.status).toBe(400);
  });
});
