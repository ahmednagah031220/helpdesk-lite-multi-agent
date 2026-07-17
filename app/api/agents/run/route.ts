import {
  createPendingAgentRun,
  runTicketAgents,
} from "@/lib/ai/orchestrator";
import { prisma } from "@/lib/db";
import { canRunAgents, canViewTicket } from "@/lib/permissions";
import { enqueueAgentRun } from "@/lib/queue/agent-queue";
import { isErrorResponse, requireSession } from "@/lib/session";
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;

  if (!canRunAgents(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { ticketId?: string; async?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.ticketId) {
    return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: body.ticketId, orgId: user.orgId },
    select: { submitterId: true, assigneeId: true, orgId: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const asyncMode = body.async !== false;

  if (asyncMode) {
    const pending = await createPendingAgentRun({
      ticketId: body.ticketId,
      triggeredById: user.id,
    });

    const queued = await enqueueAgentRun({
      runId: pending.id,
      ticketId: body.ticketId,
      triggeredById: user.id,
    });

    if (queued) {
      await prisma.agentRun.update({
        where: { id: pending.id },
        data: { jobId: queued.jobId },
      });
      return NextResponse.json(
        { ...pending, jobId: queued.jobId, queue: "redis" },
        { status: 202 },
      );
    }

    // Fallback when Redis/worker is unavailable (local demos without `npm run worker`)
    after(async () => {
      try {
        await runTicketAgents({
          ticketId: body.ticketId!,
          triggeredById: user.id,
          existingRunId: pending.id,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Agent run failed";
        console.error(`[agents/run] after() failure ${pending.id}:`, message);
      }
    });

    return NextResponse.json(
      { ...pending, queue: "inline" },
      { status: 202 },
    );
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
