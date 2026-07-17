import { AppHeader } from "@/components/AppHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canViewAgentRuns,
  getAgentRunListFilter,
} from "@/lib/permissions";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AgentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
    orgId: session.user.orgId,
  };

  if (!canViewAgentRuns(user)) redirect("/dashboard");
  const runFilter = getAgentRunListFilter(user);

  const [runs, metrics, succeeded, total] = await Promise.all([
    prisma.agentRun.findMany({
      where: runFilter,
      orderBy: { startedAt: "desc" },
      take: 20,
      include: {
        ticket: { select: { id: true, title: true } },
        recommendation: { select: { decision: true, confidence: true } },
      },
    }),
    prisma.agentRun.aggregate({
      where: {
        ...runFilter,
        status: "SUCCEEDED",
        durationMs: { not: null },
      },
      _count: { id: true },
      _avg: { durationMs: true },
    }),
    prisma.agentRun.count({
      where: { ...runFilter, status: "SUCCEEDED" },
    }),
    prisma.agentRun.count({ where: runFilter }),
  ]);

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Agent runs</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Multi-step orchestration history and reliability metrics.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">Total runs</p>
            <p className="text-2xl font-semibold">{total}</p>
          </div>
          <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">Success rate</p>
            <p className="text-2xl font-semibold">
              {total === 0 ? "—" : `${Math.round((succeeded / total) * 100)}%`}
            </p>
          </div>
          <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">Avg duration</p>
            <p className="text-2xl font-semibold">
              {metrics._avg.durationMs
                ? `${Math.round(metrics._avg.durationMs)}ms`
                : "—"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Ticket</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Decision</th>
                <th className="px-4 py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/tickets/${run.ticket.id}`}
                      className="hover:underline"
                    >
                      {run.ticket.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{run.status}</td>
                  <td className="px-4 py-2">{run.provider}</td>
                  <td className="px-4 py-2">
                    {run.recommendation?.decision ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {run.durationMs != null ? `${run.durationMs}ms` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
