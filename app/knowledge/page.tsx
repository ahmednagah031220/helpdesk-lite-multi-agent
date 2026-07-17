import { AppHeader } from "@/components/AppHeader";
import { KnowledgeUploadForm } from "@/components/KnowledgeUploadForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageKnowledge } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function KnowledgePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
  };

  if (!canManageKnowledge(user)) redirect("/dashboard");

  const docs = await prisma.knowledgeDocument.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge sources</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload PDF/text handbooks used by the knowledge retrieval agent.
          </p>
        </div>
        <KnowledgeUploadForm />
        <section className="space-y-2">
          <h2 className="font-medium">Uploaded documents</h2>
          {docs.length === 0 ? (
            <p className="text-sm text-zinc-500">No documents yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="rounded border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-zinc-500">
                    {doc.filename} · {doc.chunkCount} chunks ·{" "}
                    {new Date(doc.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
