import { AppHeader } from "@/components/AppHeader";
import { TicketTable } from "@/components/TicketTable";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function MyTicketsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // "My tickets" always means tickets this user submitted (all roles), org-scoped.
  const tickets = await prisma.ticket.findMany({
    where: { submitterId: session.user.id, orgId: session.user.orgId },
    orderBy: { updatedAt: "desc" },
    include: {
      submitter: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">My tickets</h1>
        <TicketTable tickets={tickets} />
      </main>
    </div>
  );
}
