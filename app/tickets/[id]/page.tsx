import { AgentPanel } from "@/components/AgentPanel";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketActions } from "@/components/TicketActions";
import { auth } from "@/lib/auth";
import { Role } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { canRunAgents, canViewTicket } from "@/lib/permissions";
import { getValidNextStatuses } from "@/lib/ticket-transitions";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function TicketDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      submitter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      statusEvents: { orderBy: { changedAt: "asc" } },
      agentRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: {
          steps: { orderBy: { startedAt: "asc" } },
          recommendation: true,
        },
      },
    },
  });

  if (!ticket) notFound();

  const user = {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
  };

  if (!canViewTicket(user, ticket)) {
    notFound();
  }

  const staffUsers =
    session.user.role === Role.STAFF
      ? await prisma.user.findMany({
          where: { role: Role.STAFF },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  const validNextStatuses = getValidNextStatuses(ticket.status);
  const latestRun = ticket.agentRuns[0] ?? null;

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{ticket.title}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {ticket.category}
              {ticket.priority ? ` · ${ticket.priority}` : ""} · Created{" "}
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-2 font-medium">Description</h2>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        </section>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-zinc-500">Submitter</dt>
            <dd>{ticket.submitter.name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Assignee</dt>
            <dd>{ticket.assignee?.name ?? "Unassigned"}</dd>
          </div>
        </dl>

        {session.user.role === Role.STAFF && (
          <TicketActions
            ticketId={ticket.id}
            currentAssigneeId={ticket.assigneeId}
            staffUsers={staffUsers}
            validNextStatuses={validNextStatuses}
          />
        )}

        {canRunAgents(user) && (
          <AgentPanel ticketId={ticket.id} initialRun={latestRun} />
        )}

        <section>
          <h2 className="mb-3 font-medium">Status history</h2>
          <ul className="space-y-2 text-sm">
            {ticket.statusEvents.map((event) => (
              <li
                key={event.id}
                className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                {event.fromStatus ? (
                  <>
                    {event.fromStatus} → {event.toStatus}
                  </>
                ) : (
                  <>Created as {event.toStatus}</>
                )}
                <span className="ml-2 text-zinc-500">
                  {new Date(event.changedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
