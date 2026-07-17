import nodemailer from "nodemailer";

export type EmailMessage = {
  subject: string;
  text: string;
  html?: string;
  to?: string[];
};

function parseList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_FROM &&
      (process.env.NOTIFY_EMAIL_TO || process.env.SMTP_USER),
  );
}

export async function sendNotificationEmail(
  message: EmailMessage,
): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "email not configured" };
  }

  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM!;
  const recipients = message.to?.length
    ? message.to
    : parseList(process.env.NOTIFY_EMAIL_TO);

  if (recipients.length === 0) {
    return { sent: false, reason: "no recipients" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from,
    to: recipients.join(", "),
    subject: message.subject,
    text: message.text,
    html: message.html ?? `<pre>${message.text}</pre>`,
  });

  return { sent: true };
}
