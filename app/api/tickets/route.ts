import { Category, TicketStatus } from "@/lib/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { canCreateTicket, getTicketListFilter } from "@/lib/permissions";
import { isErrorResponse, requireSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

const CATEGORIES = Object.values(Category);

export async function GET(request: NextRequest) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as TicketStatus | null;
  const category = searchParams.get("category") as Category | null;

  const where: Prisma.TicketWhereInput = {
    ...getTicketListFilter(user),
  };

  if (status && Object.values(TicketStatus).includes(status)) {
    where.status = status;
  }
  if (category && CATEGORIES.includes(category)) {
    where.category = category;
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      submitter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(tickets);
}

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;

  if (!canCreateTicket()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, description, category } = body as {
    title?: string;
    description?: string;
    category?: Category;
  };

  if (!title?.trim() || !description?.trim() || !category) {
    return NextResponse.json(
      { error: "title, description, and category are required" },
      { status: 400 },
    );
  }

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const ticket = await prisma.ticket.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      category,
      submitterId: user.id,
      statusEvents: {
        create: {
          fromStatus: null,
          toStatus: TicketStatus.OPEN,
          changedBy: user.id,
        },
      },
    },
    include: {
      submitter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(ticket, { status: 201 });
}
