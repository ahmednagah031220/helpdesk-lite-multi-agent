"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = {
  id: string;
  name: string;
  status: string;
  durationMs: number | null;
  output: string | null;
  evidence: string | null;
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

export function AgentPanel({
  ticketId,
  initialRun,
}: {
  ticketId: string;
  initialRun: Run | null;
}) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(initialRun);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function startRun() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Agent run failed");
        return;
      }
      setRun(data);
      router.refresh();
    } catch {
      setError("Agent run failed");
    } finally {
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
    ? safeJsonArray(run.recommendation.citations)
    : [];

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
          disabled={loading}
          onClick={startRun}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run agents"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </p>
      )}

      {run && (
        <div className="space-y-3 text-sm">
          <p>
            Run <code className="text-xs">{run.id}</code> · {run.status} ·{" "}
            {run.provider}
            {run.durationMs != null ? ` · ${run.durationMs}ms` : ""}
          </p>
          {run.error && <p className="text-red-600">{run.error}</p>}

          <ul className="space-y-1">
            {run.steps.map((step) => (
              <li
                key={step.id}
                className="rounded border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="font-medium">{step.name}</span> — {step.status}
                {step.durationMs != null ? ` (${step.durationMs}ms)` : ""}
              </li>
            ))}
          </ul>

          {run.recommendation && (
            <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p>
                Suggested:{" "}
                <strong>{run.recommendation.suggestedCategory ?? "—"}</strong> /{" "}
                <strong>{run.recommendation.suggestedPriority ?? "—"}</strong>{" "}
                (confidence {(run.recommendation.confidence * 100).toFixed(0)}%)
              </p>
              <p className="whitespace-pre-wrap">{run.recommendation.draftResponse}</p>
              {actions.length > 0 && (
                <ul className="list-disc pl-5">
                  {actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              )}
              {citations.length > 0 && (
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Citations:{" "}
                  {citations
                    .map((c) =>
                      typeof c === "object" && c && "documentTitle" in c
                        ? String((c as { documentTitle: string }).documentTitle)
                        : String(c),
                    )
                    .join(", ")}
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
