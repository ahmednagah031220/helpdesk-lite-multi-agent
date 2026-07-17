import { AppHeader } from "@/components/AppHeader";
import { TicketTable } from "@/components/TicketTable";
import { auth } from "@/lib/auth";
import { Role } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.STAFF) redirect("/dashboard");

  const orgId = session.user.orgId;
  const [unassigned, assignedToMe] = await Promise.all([
    prisma.ticket.findMany({
      where: { orgId, assigneeId: null },
      orderBy: { createdAt: "asc" },
      include: {
        submitter: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { orgId, assigneeId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        submitter: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <h1 className="text-2xl font-semibold">Staff queue</h1>
        <section>
          <h2 className="mb-3 text-lg font-medium">Unassigned</h2>
          <TicketTable tickets={unassigned} />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-medium">Assigned to me</h2>
          <TicketTable tickets={assignedToMe} />
        </section>
      </main>
    </div>
  );
}
