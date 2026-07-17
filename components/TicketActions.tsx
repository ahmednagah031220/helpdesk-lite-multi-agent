"use client";

import { TicketStatus } from "@/lib/enums";
import { useRouter } from "next/navigation";
import { useState } from "react";

type StaffUser = { id: string; name: string };

type Props = {
  ticketId: string;
  currentAssigneeId: string | null;
  staffUsers: StaffUser[];
  validNextStatuses: TicketStatus[];
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function TicketActions({
  ticketId,
  currentAssigneeId,
  staffUsers,
  validNextStatuses,
}: Props) {
  const router = useRouter();
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? "");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAssign() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeId: assigneeId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to assign");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to assign");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange() {
    if (!status) return;
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to update status");
        return;
      }
      setStatus("");
      router.refresh();
    } catch {
      setError("Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">Staff actions</h2>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="assignee" className="mb-1 block text-sm">
            Assignee
          </label>
          <select
            id="assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Unassigned</option>
            {staffUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={handleAssign}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save assignee
        </button>
      </div>
      {validNextStatuses.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="status" className="mb-1 block text-sm">
              New status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus | "")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Select…</option>
              {validNextStatuses.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={loading || !status}
            onClick={handleStatusChange}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Update status
          </button>
        </div>
      )}
    </div>
  );
}
