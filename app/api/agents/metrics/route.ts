import { prisma } from "@/lib/db";
import {
  canViewAgentRuns,
  getAgentRunListFilter,
} from "@/lib/permissions";
import { isErrorResponse, requireSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;
  if (!canViewAgentRuns(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const runFilter = getAgentRunListFilter(user);

  const [total, succeeded, failed, pendingRecs, recentReports, avg] = await Promise.all([
    prisma.agentRun.count({ where: runFilter }),
    prisma.agentRun.count({ where: { ...runFilter, status: "SUCCEEDED" } }),
    prisma.agentRun.count({ where: { ...runFilter, status: "FAILED" } }),
    prisma.aiRecommendation.count({
      where: {
        decision: "PENDING",
        run: Object.keys(runFilter).length === 0 ? undefined : { is: runFilter },
      },
    }),
    prisma.agentReport.findMany({
      where:
        Object.keys(runFilter).length === 0
          ? undefined
          : { run: { is: runFilter } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { run: { select: { ticketId: true, durationMs: true, provider: true } } },
    }),
    prisma.agentRun.aggregate({
      where: {
        ...runFilter,
        status: "SUCCEEDED",
        durationMs: { not: null },
      },
      _avg: { durationMs: true },
    }),
  ]);

  return NextResponse.json({
    totalRuns: total,
    succeeded,
    failed,
    successRate: total === 0 ? 0 : succeeded / total,
    pendingRecommendations: pendingRecs,
    avgDurationMs: avg._avg.durationMs ?? 0,
    recentReports,
  });
}
