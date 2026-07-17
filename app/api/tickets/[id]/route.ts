import { Role, TicketStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import {
  canAssignTicket,
  canUpdateTicketStatus,
  canViewTicket,
} from "@/lib/permissions";
import { isErrorResponse, requireSession } from "@/lib/session";
import { notify } from "@/lib/notifications";
import { canTransition } from "@/lib/ticket-transitions";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  const ticket = await prisma.ticket.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      submitter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      statusEvents: { orderBy: { changedAt: "asc" } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(ticket);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireSession();
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  const ticket = await prisma.ticket.findFirst({
    where: { id, orgId: user.orgId },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assigneeId, status } = body as {
    assigneeId?: string | null;
    status?: TicketStatus;
  };

  const updates: { assigneeId?: string | null; status?: TicketStatus } = {};
  const statusEvents: {
    fromStatus: TicketStatus | null;
    toStatus: TicketStatus;
    changedBy: string;
  }[] = [];

  if (assigneeId !== undefined) {
    if (!canAssignTicket(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (assigneeId !== null) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
      });
      if (!assignee || assignee.role !== Role.STAFF) {
        return NextResponse.json(
          { error: "Assignee must be a staff member" },
          { status: 400 },
        );
      }
    }

    updates.assigneeId = assigneeId;
  }

  if (status !== undefined) {
    if (!canUpdateTicketStatus(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!Object.values(TicketStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (!canTransition(ticket.status, status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${ticket.status} to ${status}` },
        { status: 400 },
      );
    }

    updates.status = status;
    statusEvents.push({
      fromStatus: ticket.status,
      toStatus: status,
      changedBy: user.id,
    });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ...updates,
      statusEvents:
        statusEvents.length > 0
          ? { create: statusEvents }
          : undefined,
    },
    include: {
      submitter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      statusEvents: { orderBy: { changedAt: "asc" } },
    },
  });

  if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
    await notify(
      "assigned",
      { id: updated.id, title: updated.title },
      {
        orgId: user.orgId,
        recipients: [
          updated.submitter.email,
          ...(updated.assignee?.email ? [updated.assignee.email] : []),
        ].filter(Boolean),
        assigneeId: updated.assigneeId,
      },
    );
  }
  if (status === TicketStatus.RESOLVED) {
    await notify(
      "resolved",
      { id: updated.id, title: updated.title },
      {
        orgId: user.orgId,
        recipients: [updated.submitter.email].filter(Boolean),
        status: updated.status,
      },
    );
  }

  return NextResponse.json(updated);
}
