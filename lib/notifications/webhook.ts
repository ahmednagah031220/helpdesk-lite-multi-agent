export type WebhookPayload = Record<string, unknown>;

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.WEBHOOK_URL?.trim());
}

export async function sendWebhook(
  payload: WebhookPayload,
): Promise<{ sent: boolean; status?: number; reason?: string }> {
  const url = process.env.WEBHOOK_URL?.trim();
  if (!url) {
    return { sent: false, reason: "webhook not configured" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "HelpDesk-Lite-Notify/1.0",
  };

  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["X-Webhook-Secret"] = secret;
  }

  const timeoutMs = Number(process.env.WEBHOOK_TIMEOUT_MS ?? 10_000);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Webhook returned ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  return { sent: true, status: response.status };
}
