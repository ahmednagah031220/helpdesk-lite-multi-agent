import { AppHeader } from "@/components/AppHeader";
import { auth } from "@/lib/auth";
import { Role } from "@/lib/enums";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role } = session.user;

  if (role === Role.EMPLOYEE) redirect("/tickets/my");
  if (role === Role.STAFF) redirect("/tickets/queue");
  if (role === Role.MANAGER) redirect("/manager/summary");

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/tickets/new">Go to tickets</Link>
      </main>
    </div>
  );
}
