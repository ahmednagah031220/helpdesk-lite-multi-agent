import { prisma } from "@/lib/db";
import { canViewAgentRuns, canViewTicket } from "@/lib/permissions";
import { isErrorResponse, requireSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;
  if (!canViewAgentRuns(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const run = await prisma.agentRun.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { startedAt: "asc" } },
      recommendation: true,
      report: true,
      ticket: {
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          submitterId: true,
          assigneeId: true,
        },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewTicket(user, run.ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(run);
}
