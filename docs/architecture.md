# Architecture

HelpDesk Lite is a multi-agent AI system that triages internal support tickets.
It gathers evidence from a knowledge base and historical tickets, runs a
sequence of LLM agents, then produces automated outputs (reports,
recommendations, email/webhook notifications) for a human to approve.

## Surfaces

| Surface | Purpose | Stack |
|---------|---------|-------|
| Next.js app | Full product: auth, tickets, knowledge upload, agent runs | Next.js 16, Prisma, PostgreSQL, NextAuth |
| Streamlit demo | Offline presentation of the same pipeline | Python + Streamlit (`streamlit_app.py`) |

Both surfaces implement the same logical pipeline. The Next.js app persists
everything to PostgreSQL; the Streamlit demo keeps state in session memory.

## High-level flow

```
Employee submits ticket
        │
        ▼
Support claims ticket ──▶ POST /api/agents/run
        │
        ▼
┌──────────────────────────────────────────────┐
│                 Orchestrator                 │
│            (lib/ai/orchestrator.ts)          │
│                                              │
│  1. Parallel retrieval                       │
│     • retriever_db  → similar tickets (SQL)  │
│     • retriever_pdf → handbook chunks (KB)   │
│                                              │
│  2. Sequential LLM agents                    │
│     triage → knowledge → resolution          │
│                    ↓                         │
│               evaluator                      │
│                                              │
│  3. Automated outputs                        │
│     • AiRecommendation (draft + metadata)    │
│     • AgentReport (markdown brief)           │
│     • notify() → audit log + email + webhook │
└──────────────────────────────────────────────┘
        │
        ▼
Support approves / rejects recommendation
  (category/priority only — never auto-closes)
```

## Layers

### Presentation
- App Router pages under `app/` (dashboard, tickets, agents, knowledge, manager)
- Role-aware UI via NextAuth session + `lib/permissions.ts`
- Streamlit role switcher for demos

### API
- REST handlers under `app/api/`
- Session required for all mutating/agent endpoints
- See [endpoints.md](./endpoints.md)

### Domain / AI
- `lib/ai/orchestrator.ts` — coordinates steps, records `AgentStep` rows
- `lib/ai/agents/*` — triage, knowledge, resolution, evaluator
- `lib/ai/retrieval/*` — DB + PDF/TXT chunk retrieval (token-overlap ranking)
- `lib/ai/providers/*` — Ollama or deterministic mock

### Data
- PostgreSQL via Prisma (`prisma/schema.prisma`)
- Knowledge documents uploaded as PDF / TXT / MD and chunked
- See [data.md](./data.md)

### Automated actions
- `lib/notifications/` fans out to:
  1. `NotificationLog` (always)
  2. SMTP email (when configured)
  3. HTTP webhook (when configured)
- See [notifications.md](./notifications.md)

## Design principles

1. **Human in the loop** — Agents suggest; staff decide. Status transitions
   remain a human action.
2. **Structured I/O** — Every LLM reply is Zod-validated JSON
   (`lib/ai/types.ts`, `lib/ai/parse.ts`).
3. **Observability** — Each agent step stores input, output, evidence, status,
   and duration.
4. **Graceful degradation** — Retrieval uses `Promise.allSettled`; provider
   selection falls back to mock when Ollama is unreachable; email/webhook
   failures never break the request after the audit log is written.
5. **Async agent runs by default** — `POST /api/agents/run` returns `202` and
   continues via Next.js `after()`; the UI polls `GET /api/agents/runs/[id]`.
6. **Role-based access** — `EMPLOYEE`, `STAFF`, `MANAGER` with filters in
   `lib/permissions.ts`.

## Provider selection

```
AI_PROVIDER=auto | ollama | mock
         │
         ├─ mock  → always deterministic offline provider
         ├─ ollama → require local Ollama HTTP API
         └─ auto  → Ollama if /api/tags succeeds, else mock
```

Default model: `qwen2.5:7b` (override with `OLLAMA_MODEL`).

## Related docs

- [Agents](./agents.md) — per-agent contracts
- [Endpoints](./endpoints.md) — HTTP surface
- [Data](./data.md) — schema and seed
- [Setup](./setup.md) — how to run locally
