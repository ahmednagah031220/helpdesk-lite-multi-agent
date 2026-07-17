import { chunkText } from "@/lib/ai/retrieval/chunk";
import { prisma } from "@/lib/db";
import { canManageKnowledge } from "@/lib/permissions";
import { isErrorResponse, requireSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md"];

export async function GET() {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;
  if (!canManageKnowledge(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const docs = await prisma.knowledgeDocument.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      filename: true,
      chunkCount: true,
      createdAt: true,
      uploadedBy: true,
    },
  });

  return NextResponse.json(docs);
}

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;
  if (!canManageKnowledge(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const filename = file.name || "upload.bin";
  const lowercaseName = filename.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((extension) => lowercaseName.endsWith(extension))) {
    return NextResponse.json(
      { error: "Only PDF, TXT, and Markdown files are supported" },
      { status: 415 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File must be 10 MB or smaller" },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let content = "";

  if (lowercaseName.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      content = parsed.text ?? "";
    } finally {
      await parser.destroy();
    }
  } else {
    content = buffer.toString("utf8");
  }

  if (!content.trim()) {
    return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
  }

  const chunks = chunkText(content);
  const doc = await prisma.knowledgeDocument.create({
    data: {
      title: title || filename,
      filename,
      content,
      chunkCount: chunks.length,
      uploadedBy: user.id,
      chunks: {
        create: chunks.map((chunk, index) => ({
          index,
          content: chunk,
        })),
      },
    },
    include: {
      chunks: { select: { id: true, index: true } },
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
