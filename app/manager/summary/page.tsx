import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { auth } from "@/lib/auth";
import { Role, TicketStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

const STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export default async function ManagerSummaryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.MANAGER) redirect("/dashboard");

  const orgId = session.user.orgId;
  const ticketScope = { orgId };
  const runScope = { ticket: { is: { orgId } } };

  const [counts, openTickets, agentTotals, agentSucceeded, recentReports] =
    await Promise.all([
      prisma.ticket.groupBy({
        by: ["status"],
        where: ticketScope,
        _count: { status: true },
      }),
      prisma.ticket.findMany({
        where: {
          ...ticketScope,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
        },
        orderBy: { createdAt: "asc" },
        include: {
          assignee: { select: { name: true } },
        },
      }),
      prisma.agentRun.count({ where: runScope }),
      prisma.agentRun.count({ where: { ...runScope, status: "SUCCEEDED" } }),
      prisma.agentReport.findMany({
        where: { run: { is: runScope } },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          run: {
            select: {
              durationMs: true,
              provider: true,
              ticket: { select: { id: true, title: true } },
            },
          },
        },
      }),
    ]);

  const countMap = Object.fromEntries(
    counts.map((row) => [row.status, row._count.status]),
  ) as Record<TicketStatus, number>;

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <h1 className="text-2xl font-semibold">Manager summary</h1>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATUSES.map((status) => (
            <div
              key={status}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="text-sm text-zinc-500">{STATUS_LABELS[status]}</p>
              <p className="mt-1 text-3xl font-semibold">
                {countMap[status] ?? 0}
              </p>
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">AI agent reliability</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">Agent runs</p>
              <p className="text-2xl font-semibold">{agentTotals}</p>
            </div>
            <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">Success rate</p>
              <p className="text-2xl font-semibold">
                {agentTotals === 0
                  ? "—"
                  : `${Math.round((agentSucceeded / agentTotals) * 100)}%`}
              </p>
            </div>
            <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">Generated reports</p>
              <p className="text-2xl font-semibold">{recentReports.length}</p>
            </div>
          </div>
          <div className="space-y-2">
            {recentReports.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No AI briefs yet. Staff can run agents from a ticket detail page.
              </p>
            ) : (
              recentReports.map((report) => (
                <article
                  key={report.id}
                  className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                >
                  <div className="mb-1 font-medium">
                    <Link
                      href={`/tickets/${report.run.ticket.id}`}
                      className="hover:underline"
                    >
                      {report.title}
                    </Link>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {report.run.provider}
                    {report.run.durationMs != null
                      ? ` · ${report.run.durationMs}ms`
                      : ""}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                    {report.body.slice(0, 500)}
                    {report.body.length > 500 ? "…" : ""}
                  </pre>
                </article>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">Open workload</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Assignee</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {openTickets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-zinc-500">
                      No open tickets.
                    </td>
                  </tr>
                ) : (
                  openTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        <td className="px-4 py-2">
                          <Link
                            href={`/tickets/${ticket.id}`}
                            className="hover:underline"
                          >
                            {ticket.title}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="px-4 py-2">
                          {ticket.assignee?.name ?? "Unassigned"}
                        </td>
                        <td className="px-4 py-2">
                          {ticket.createdAt.toLocaleDateString()}
                        </td>
                      </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
