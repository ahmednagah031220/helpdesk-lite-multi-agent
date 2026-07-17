# Endpoints

All `/api/*` routes (except auth) require a NextAuth session cookie.
Unauthorized requests return `401`. Forbidden role checks return `403`.

## Auth

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers (credentials sign-in) |

Login UI: `/login` (server action in `app/login/actions.ts`).

## Tickets

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/tickets` | any authenticated | List tickets visible to the caller |
| POST | `/api/tickets` | any authenticated | Create a ticket |
| GET | `/api/tickets/[id]` | viewer of ticket | Ticket detail |
| PATCH | `/api/tickets/[id]` | STAFF (status/assign) | Update status, assignee, etc. Emits `assigned` / `resolved` notifications |

### Create body (`POST /api/tickets`)

```json
{
  "title": "Office WiFi disconnects",
  "description": "Laptop drops WiFi every few minutes.",
  "category": "IT"
}
```

### Patch body (`PATCH /api/tickets/[id]`)

```json
{
  "status": "IN_PROGRESS",
  "assigneeId": "cuid...",
  "priority": "HIGH"
}
```

## Knowledge base

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/knowledge` | STAFF, MANAGER | List uploaded documents |
| POST | `/api/knowledge` | STAFF, MANAGER | Multipart upload (`file`, optional `title`). Accepts `.pdf`, `.txt`, `.md` (max 10 MB) |

## Agents

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/api/agents/run` | STAFF, MANAGER | Enqueue/run multi-agent pipeline. Default `{ async: true }` returns `202` + `PENDING` run (poll `GET /api/agents/runs/[id]`). Pass `{ async: false }` for synchronous `201`. |
| GET | `/api/agents/runs/[id]` | STAFF, MANAGER | Fetch one run with steps / recommendation / report |
| GET | `/api/agents/metrics` | STAFF, MANAGER | Aggregate success rate, latency, pending recs, recent reports |
| PATCH | `/api/agents/recommendations/[id]` | STAFF | Approve or reject an AI recommendation |

### Run body (`POST /api/agents/run`)

```json
{ "ticketId": "cuid..." }
```

Response `201`: `AgentRun` including `steps`, `recommendation`, `report`.
`maxDuration` is 180 seconds to allow slow local LLMs.

### Recommendation decision (`PATCH /api/agents/recommendations/[id]`)

```json
{
  "decision": "APPROVED",
  "note": "Looks good",
  "applyCategory": true
}
```

- `APPROVED` with `applyCategory !== false` updates ticket **category** and
  **priority** only — never status.
- Emits `ai_recommendation_approved` or `ai_recommendation_rejected`
  (email + webhook + audit log).

## App pages (UI)

| Path | Roles | Purpose |
|------|-------|---------|
| `/` | public → redirect | Landing |
| `/login` | public | Sign in |
| `/dashboard` | authenticated | Role home |
| `/tickets/new` | authenticated | Submit ticket |
| `/tickets/my` | EMPLOYEE+ | Own tickets |
| `/tickets/queue` | STAFF | Work queue |
| `/tickets/[id]` | viewer | Detail + agent panel |
| `/knowledge` | STAFF, MANAGER | Upload / list docs |
| `/agents` | STAFF, MANAGER | Run history + metrics |
| `/manager/summary` | MANAGER | Team summary dashboard |

## Streamlit demo (separate process)

Not an HTTP API of the Next.js app. Run with:

```bash
streamlit run streamlit_app.py
```

Role demos (Employee / Support / Manager) mirror the same pipeline in-process.
