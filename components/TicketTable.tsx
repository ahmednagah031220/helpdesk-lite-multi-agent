import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketStatus } from "@/lib/enums";

export type TicketRow = {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
  submitter?: { name: string };
  assignee?: { name: string } | null;
};

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString();
}

export function TicketTable({ tickets }: { tickets: TicketRow[] }) {
  if (tickets.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">No tickets found.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2 font-medium">Title</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Submitter</th>
            <th className="px-4 py-2 font-medium">Assignee</th>
            <th className="px-4 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              className="border-t border-zinc-200 dark:border-zinc-800"
            >
              <td className="px-4 py-2">
                <Link href={`/tickets/${ticket.id}`} className="hover:underline">
                  {ticket.title}
                </Link>
              </td>
              <td className="px-4 py-2">{ticket.category}</td>
              <td className="px-4 py-2">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-2">{ticket.submitter?.name ?? "—"}</td>
              <td className="px-4 py-2">{ticket.assignee?.name ?? "Unassigned"}</td>
              <td className="px-4 py-2">{formatDate(ticket.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
