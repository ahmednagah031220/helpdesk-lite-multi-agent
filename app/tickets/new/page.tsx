import { AppHeader } from "@/components/AppHeader";
import { TicketForm } from "@/components/TicketForm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewTicketPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Submit a support request</h1>
        <TicketForm />
      </main>
    </div>
  );
}
