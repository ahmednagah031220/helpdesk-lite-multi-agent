# Notifications

Module: `lib/notifications/`.

Every automated action goes through `notify(event, ticket, extra?)`, which:

1. **Always** writes a `NotificationLog` row (audit evidence)
2. Logs to the server console
3. **Optionally** sends SMTP email (if configured)
4. **Optionally** POSTs a JSON webhook (if configured)

External sink failures are caught and logged; they do **not** fail the HTTP
request after the audit log is written.

## Events

| Event | When |
|-------|------|
| `assigned` | Ticket assignee changes (`PATCH /api/tickets/[id]`) |
| `resolved` | Ticket status set to `RESOLVED` |
| `ai_run_completed` | Multi-agent run succeeds |
| `ai_report_generated` | AI brief (`AgentReport`) is created |
| `ai_recommendation_approved` | Staff approves a recommendation |
| `ai_recommendation_rejected` | Staff rejects a recommendation |

## Email (SMTP)

Configured via:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=secret
SMTP_FROM="HelpDesk Lite <noreply@example.com>"
NOTIFY_EMAIL_TO=staff@example.com,manager@example.com
```

- Uses **nodemailer**
- Per-call `recipients` in `extra` override `NOTIFY_EMAIL_TO` (e.g. ticket
  submitter/assignee on assign/resolve)
- Skipped entirely when `SMTP_HOST` / `SMTP_FROM` / recipients are missing

## Webhook

```env
WEBHOOK_URL=https://hooks.example.com/helpdesk
WEBHOOK_SECRET=optional-shared-secret
WEBHOOK_TIMEOUT_MS=10000
```

- `POST` JSON body = notification payload + `"source": "helpdesk-lite"`
- If `WEBHOOK_SECRET` is set, sends:
  - `Authorization: Bearer <secret>`
  - `X-Webhook-Secret: <secret>`
- Compatible with Slack incoming webhooks, Zapier, n8n, custom receivers, etc.

### Example payload

```json
{
  "event": "ai_run_completed",
  "ticketId": "clx...",
  "title": "WiFi keeps dropping",
  "runId": "clx...",
  "recommendationId": "clx...",
  "reportId": "clx...",
  "category": "IT",
  "priority": "MEDIUM",
  "confidence": 0.85,
  "at": "2026-07-17T21:00:00.000Z",
  "source": "helpdesk-lite"
}
```

## Testing

`lib/notifications/notifications.test.ts` covers audit-log persistence,
SMTP send, webhook POST, and non-fatal sink errors.
