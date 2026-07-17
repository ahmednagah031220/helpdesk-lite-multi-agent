import { runTicketAgents } from "@/lib/ai/orchestrator";
import { prisma } from "@/lib/db";
import { canRunAgents, canViewTicket } from "@/lib/permissions";
import { isErrorResponse, requireSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;

  if (!canRunAgents(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { ticketId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.ticketId) {
    return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: body.ticketId },
    select: { submitterId: true, assigneeId: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const run = await runTicketAgents({
      ticketId: body.ticketId,
      triggeredById: user.id,
    });
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
