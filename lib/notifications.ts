import { prisma } from "@/lib/db";

export type NotificationEvent =
  | "assigned"
  | "resolved"
  | "ai_run_completed"
  | "ai_recommendation_approved"
  | "ai_recommendation_rejected"
  | "ai_report_generated";

export async function notify(
  event: NotificationEvent,
  ticket: { id: string; title: string },
  extra?: Record<string, unknown>,
) {
  const payload = {
    event,
    ticketId: ticket.id,
    title: ticket.title,
    ...extra,
    at: new Date().toISOString(),
  };

  // Persist automated action for audit/demo evidence
  await prisma.notificationLog.create({
    data: {
      event,
      ticketId: ticket.id,
      payload: JSON.stringify(payload),
    },
  });

  // Keep console sink for local visibility
  console.log(`[notify:${event}] Ticket ${ticket.id}: ${ticket.title}`);
}
