"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function KnowledgeUploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a PDF or text file");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("file", file);
      const response = await fetch("/api/knowledge", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setTitle("");
      setFile(null);
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Internal Support Handbook"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="file">
          PDF or text file
        </label>
        <input
          id="file"
          type="file"
          accept=".pdf,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Uploading…" : "Upload knowledge source"}
      </button>
    </form>
  );
}
