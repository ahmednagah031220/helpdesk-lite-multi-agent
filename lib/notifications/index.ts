import { prisma } from "@/lib/db";
import {
  isEmailConfigured,
  sendNotificationEmail,
} from "@/lib/notifications/email";
import {
  isWebhookConfigured,
  sendWebhook,
} from "@/lib/notifications/webhook";

export type NotificationEvent =
  | "assigned"
  | "resolved"
  | "ai_run_completed"
  | "ai_recommendation_approved"
  | "ai_recommendation_rejected"
  | "ai_report_generated";

export type NotifyOptions = {
  recipients?: string[];
  orgId?: string;
  [key: string]: unknown;
};

const EVENT_SUBJECTS: Record<NotificationEvent, string> = {
  assigned: "Ticket assigned",
  resolved: "Ticket resolved",
  ai_run_completed: "AI agent run completed",
  ai_recommendation_approved: "AI recommendation approved",
  ai_recommendation_rejected: "AI recommendation rejected",
  ai_report_generated: "AI report generated",
};

function buildEmailBody(
  event: NotificationEvent,
  ticket: { id: string; title: string },
  payload: Record<string, unknown>,
): { subject: string; text: string } {
  const subject = `[HelpDesk Lite] ${EVENT_SUBJECTS[event]}: ${ticket.title}`;
  const lines = [
    `Event: ${event}`,
    `Ticket ID: ${ticket.id}`,
    `Title: ${ticket.title}`,
    `Time: ${payload.at}`,
    "",
    "Details:",
    JSON.stringify(payload, null, 2),
  ];
  return { subject, text: lines.join("\n") };
}

/**
 * Persist an audit log entry and fan out to optional email + webhook sinks.
 * Sinks that are not configured are skipped. Failures in external sinks are
 * logged but do not fail the calling request (audit log is always written first).
 */
export async function notify(
  event: NotificationEvent,
  ticket: { id: string; title: string },
  extra?: NotifyOptions,
) {
  const { recipients, orgId, ...rest } = extra ?? {};
  const payload = {
    event,
    ticketId: ticket.id,
    title: ticket.title,
    orgId,
    ...rest,
    at: new Date().toISOString(),
  };

  await prisma.notificationLog.create({
    data: {
      event,
      ticketId: ticket.id,
      orgId: orgId ?? null,
      payload: JSON.stringify(payload),
    },
  });

  console.log(`[notify:${event}] Ticket ${ticket.id}: ${ticket.title}`);

  const delivery: {
    email?: { sent: boolean; reason?: string };
    webhook?: { sent: boolean; status?: number; reason?: string };
  } = {};

  if (isEmailConfigured()) {
    try {
      const { subject, text } = buildEmailBody(event, ticket, payload);
      delivery.email = await sendNotificationEmail({
        subject,
        text,
        to: recipients,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "email failed";
      console.error(`[notify:${event}] email sink failed:`, reason);
      delivery.email = { sent: false, reason };
    }
  }

  if (isWebhookConfigured()) {
    try {
      delivery.webhook = await sendWebhook({
        ...payload,
        source: "helpdesk-lite",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "webhook failed";
      console.error(`[notify:${event}] webhook sink failed:`, reason);
      delivery.webhook = { sent: false, reason };
    }
  }

  return { payload, delivery };
}

export { isEmailConfigured, isWebhookConfigured };
