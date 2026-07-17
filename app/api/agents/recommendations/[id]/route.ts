import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import {
  canDecideRecommendation,
  canViewTicket,
} from "@/lib/permissions";
import { isErrorResponse, requireSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;
  if (!canDecideRecommendation(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  let body: { decision?: "APPROVED" | "REJECTED"; note?: string; applyCategory?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  const recommendation = await prisma.aiRecommendation.findUnique({
    where: { id },
    include: { run: { include: { ticket: true } } },
  });

  if (!recommendation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewTicket(user, recommendation.run.ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (recommendation.decision !== "PENDING") {
    return NextResponse.json(
      { error: "Recommendation has already been decided" },
      { status: 409 },
    );
  }

  const updated = await prisma.aiRecommendation.update({
    where: { id },
    data: {
      decision: body.decision,
      decidedById: user.id,
      decidedAt: new Date(),
      decisionNote: body.note ?? null,
    },
  });

  // Safe apply: category/priority metadata only — never auto-resolve/close
  if (body.decision === "APPROVED" && body.applyCategory !== false) {
    await prisma.ticket.update({
      where: { id: recommendation.run.ticketId },
      data: {
        category: recommendation.suggestedCategory ?? undefined,
        priority: recommendation.suggestedPriority ?? undefined,
      },
    });
  }

  await notify(
    body.decision === "APPROVED"
      ? "ai_recommendation_approved"
      : "ai_recommendation_rejected",
    {
      id: recommendation.run.ticketId,
      title: recommendation.run.ticket.title,
    },
    { recommendationId: id, note: body.note ?? null },
  );

  return NextResponse.json(updated);
}
