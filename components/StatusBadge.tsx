import { TicketStatus } from "@/lib/enums";

const STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  IN_PROGRESS:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  RESOLVED:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  CLOSED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
