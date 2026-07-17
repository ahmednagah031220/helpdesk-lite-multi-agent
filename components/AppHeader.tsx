import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Role } from "@/lib/enums";

export async function AppHeader() {
  const session = await auth();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold">
          HelpDesk Lite
        </Link>
        {session?.user && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {session.user.name}{" "}
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs uppercase dark:bg-zinc-800">
                {session.user.role}
              </span>
            </span>
            <nav className="flex gap-3">
              <Link href="/tickets/new" className="hover:underline">
                New ticket
              </Link>
              <Link href="/tickets/my" className="hover:underline">
                My tickets
              </Link>
              {session.user.role === Role.STAFF && (
                <Link href="/tickets/queue" className="hover:underline">
                  Queue
                </Link>
              )}
              {(session.user.role === Role.STAFF ||
                session.user.role === Role.MANAGER) && (
                <>
                  <Link href="/knowledge" className="hover:underline">
                    Knowledge
                  </Link>
                  <Link href="/agents" className="hover:underline">
                    Agents
                  </Link>
                </>
              )}
              {session.user.role === Role.MANAGER && (
                <Link href="/manager/summary" className="hover:underline">
                  Summary
                </Link>
              )}
            </nav>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="text-zinc-600 hover:underline dark:text-zinc-400">
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
