"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Step = {
  id: string;
  name: string;
  status: string;
  durationMs: number | null;
  output: string | null;
  evidence: string | null;
};

type Citation = {
  documentTitle?: string;
  excerpt?: string;
  score?: number;
};

type Recommendation = {
  id: string;
  suggestedCategory: string | null;
  suggestedPriority: string | null;
  draftResponse: string;
  recommendedActions: string;
  confidence: number;
  needsHumanReview: boolean;
  citations: string;
  decision: string;
};

type Run = {
  id: string;
  status: string;
  provider: string;
  model: string;
  durationMs: number | null;
  error: string | null;
  steps: Step[];
  recommendation: Recommendation | null;
};

const PIPELINE_ORDER = [
  "retriever_db",
  "retriever_pdf",
  "triage",
  "knowledge",
  "resolution",
  "evaluator",
];

export function AgentPanel({
  ticketId,
  initialRun,
}: {
  ticketId: string;
  initialRun: Run | null;
}) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(initialRun);
  const [loading, setLoading] = useState(
    () =>
      initialRun?.status === "PENDING" || initialRun?.status === "RUNNING",
  );
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Resume polling if the page loads with an in-flight async run
  useEffect(() => {
    if (
      initialRun &&
      (initialRun.status === "PENDING" || initialRun.status === "RUNNING")
    ) {
      startPolling(initialRun.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount / initial run id
  }, [initialRun?.id, initialRun?.status]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function fetchRun(runId: string): Promise<Run | null> {
    const response = await fetch(`/api/agents/runs/${runId}`);
    if (!response.ok) return null;
    return (await response.json()) as Run;
  }

  function startPolling(runId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const latest = await fetchRun(runId);
      if (!latest) return;
      setRun(latest);
      if (latest.status === "SUCCEEDED" || latest.status === "FAILED") {
        stopPolling();
        setLoading(false);
        router.refresh();
      }
    }, 1500);
  }

  async function startRun() {
    setLoading(true);
    setError(null);
    stopPolling();
    try {
      const response = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, async: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Agent run failed");
        setLoading(false);
        return;
      }

      // 202 async enqueue or 201 sync completion
      if (response.status === 202 || data.status === "PENDING" || data.status === "RUNNING") {
        setRun({
          ...data,
          steps: data.steps ?? [],
          recommendation: data.recommendation ?? null,
        });
        startPolling(data.id);
        return;
      }

      setRun(data);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Agent run failed");
      setLoading(false);
    }
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!run?.recommendation) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/agents/recommendations/${run.recommendation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note, applyCategory: true }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Decision failed");
        return;
      }
      setRun({
        ...run,
        recommendation: { ...run.recommendation, ...data },
      });
      router.refresh();
    } catch {
      setError("Decision failed");
    } finally {
      setLoading(false);
    }
  }

  const actions = run?.recommendation
    ? safeJsonStringArray(run.recommendation.recommendedActions)
    : [];
  const citations = run?.recommendation
    ? (safeJsonArray(run.recommendation.citations) as Citation[])
    : [];

  const stepByName = new Map((run?.steps ?? []).map((step) => [step.name, step]));
  const isActive = run?.status === "PENDING" || run?.status === "RUNNING";

  return (
    <section className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Multi-agent AI assist</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Parallel DB + PDF retrieval → triage → knowledge → resolution → evaluator
          </p>
        </div>
        <button
          type="button"
          disabled={loading || isActive}
          onClick={startRun}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading || isActive ? "Running…" : "Run agents"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </p>
      )}

      {run && (
        <div className="space-y-4 text-sm">
          <p>
            Run <code className="text-xs">{run.id}</code> · {run.status} ·{" "}
            {run.provider}
            {run.durationMs != null ? ` · ${run.durationMs}ms` : ""}
          </p>
          {run.error && <p className="text-red-600">{run.error}</p>}

          <ol className="relative space-y-0 border-l border-indigo-300 pl-4 dark:border-indigo-800">
            {PIPELINE_ORDER.map((name, index) => {
              const step = stepByName.get(name);
              const status = step?.status ?? (isActive ? "WAITING" : "—");
              const tone =
                status === "SUCCEEDED"
                  ? "bg-green-500"
                  : status === "FAILED"
                    ? "bg-red-500"
                    : status === "WAITING" || isActive
                      ? "bg-amber-400"
                      : "bg-zinc-300";
              return (
                <li key={name} className="relative pb-4 last:pb-0">
                  <span
                    className={`absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full ${tone}`}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {index + 1}. {name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {status}
                      {step?.durationMs != null ? ` · ${step.durationMs}ms` : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {run.recommendation && (
            <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center gap-3">
                <p>
                  Suggested:{" "}
                  <strong>{run.recommendation.suggestedCategory ?? "—"}</strong> /{" "}
                  <strong>{run.recommendation.suggestedPriority ?? "—"}</strong>
                </p>
                <ConfidenceMeter value={run.recommendation.confidence} />
              </div>
              <p className="whitespace-pre-wrap">{run.recommendation.draftResponse}</p>
              {actions.length > 0 && (
                <ul className="list-disc pl-5">
                  {actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              )}
              {citations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Citations
                  </p>
                  <ul className="space-y-2">
                    {citations.map((citation, index) => (
                      <li
                        key={`${citation.documentTitle ?? "cite"}-${index}`}
                        className="rounded border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
                      >
                        <p className="font-medium">
                          {citation.documentTitle ?? "Source"}
                          {typeof citation.score === "number"
                            ? ` · score ${(citation.score * 100).toFixed(0)}%`
                            : ""}
                        </p>
                        {citation.excerpt && (
                          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                            {citation.excerpt}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs">
                Decision: <strong>{run.recommendation.decision}</strong>
                {run.recommendation.needsHumanReview ? " · needs human review" : ""}
              </p>
              {run.recommendation.decision === "PENDING" && (
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note"
                    className="min-w-[200px] flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => decide("APPROVED")}
                    className="rounded bg-green-700 px-3 py-1.5 text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => decide("REJECTED")}
                    className="rounded bg-zinc-700 px-3 py-1.5 text-white disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="flex min-w-[140px] flex-1 items-center gap-2"
      title={`Confidence ${pct}%`}
    >
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
        {pct}%
      </span>
    </div>
  );
}

function safeJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonStringArray(value: string): string[] {
  return safeJsonArray(value).map((item) => String(item));
}
