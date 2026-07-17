import { loginAction } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <LoginForm searchParams={searchParams} />
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">HelpDesk Lite</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Sign in with your internal account
      </p>
      <form action={loginAction} className="space-y-4">
        {params.error === "invalid" && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Invalid email or password
          </p>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Sign in
        </button>
      </form>
      <p className="mt-6 text-xs text-zinc-500">
        Demo: employee@helpdesk.local / staff@helpdesk.local / manager@helpdesk.local
        — password: password123
      </p>
    </main>
  );
}
