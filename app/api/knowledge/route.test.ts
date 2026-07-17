import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: {
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    role: "STAFF",
  },
  documentFindMany: vi.fn(),
  documentCreate: vi.fn(),
  pdfGetText: vi.fn(),
  pdfDestroy: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: () => mocks.user,
  isErrorResponse: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    knowledgeDocument: {
      findMany: mocks.documentFindMany,
      create: mocks.documentCreate,
    },
  },
}));
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText = mocks.pdfGetText;
    destroy = mocks.pdfDestroy;
  },
}));

import { GET, POST } from "@/app/api/knowledge/route";

function uploadRequest(file: File, title = ""): NextRequest {
  const form = new FormData();
  form.set("file", file);
  form.set("title", title);
  return new NextRequest("http://localhost/api/knowledge", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.role = "STAFF";
  mocks.documentFindMany.mockResolvedValue([]);
  mocks.documentCreate.mockImplementation(async ({ data }) => ({
    id: "doc-1",
    ...data,
    chunks: data.chunks.create.map(
      (chunk: { index: number; content: string }) => ({
        id: `chunk-${chunk.index}`,
        index: chunk.index,
      }),
    ),
  }));
  mocks.pdfGetText.mockResolvedValue({ text: "Extracted PDF handbook guidance" });
  mocks.pdfDestroy.mockResolvedValue(undefined);
});

describe("knowledge API", () => {
  it("lists sources for authorized staff", async () => {
    mocks.documentFindMany.mockResolvedValue([
      { id: "doc-1", title: "Handbook", filename: "handbook.txt" },
    ]);
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: "doc-1", title: "Handbook", filename: "handbook.txt" },
    ]);
  });

  it("chunks and persists a text knowledge source", async () => {
    const content = "network handbook ".repeat(100);
    const response = await POST(
      uploadRequest(
        new File([content], "handbook.txt", { type: "text/plain" }),
        "Internal Handbook",
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.documentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Internal Handbook",
        filename: "handbook.txt",
        uploadedBy: "staff-1",
        chunkCount: expect.any(Number),
        chunks: {
          create: expect.arrayContaining([
            expect.objectContaining({ index: 0 }),
          ]),
        },
      }),
      include: {
        chunks: { select: { id: true, index: true } },
      },
    });
    expect(
      mocks.documentCreate.mock.calls[0][0].data.chunkCount,
    ).toBeGreaterThan(1);
  });

  it("extracts PDF text and always destroys the parser", async () => {
    const response = await POST(
      uploadRequest(
        new File(["%PDF demo"], "handbook.pdf", {
          type: "application/pdf",
        }),
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.pdfGetText).toHaveBeenCalledOnce();
    expect(mocks.pdfDestroy).toHaveBeenCalledOnce();
    expect(mocks.documentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filename: "handbook.pdf",
          content: "Extracted PDF handbook guidance",
        }),
      }),
    );
  });

  it("rejects unsupported and oversized uploads", async () => {
    const unsupported = await POST(
      uploadRequest(new File(["binary"], "payload.exe")),
    );
    expect(unsupported.status).toBe(415);

    const oversized = await POST(
      uploadRequest(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.txt"),
      ),
    );
    expect(oversized.status).toBe(413);
    expect(mocks.documentCreate).not.toHaveBeenCalled();
  });

  it("forbids employees", async () => {
    mocks.user.role = "EMPLOYEE";
    const response = await POST(
      uploadRequest(new File(["handbook"], "handbook.txt")),
    );

    expect(response.status).toBe(403);
    expect(mocks.documentCreate).not.toHaveBeenCalled();
  });
});
