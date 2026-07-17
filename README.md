# HelpDesk Lite — Multi-Agent AI System

A fully functional, multi-agent AI system that automates internal IT/HR/Facilities
help-desk triage. When a ticket arrives, a pipeline of specialized AI agents
**retrieves** supporting evidence, **processes and summarizes** it with an LLM,
runs a **guardrail evaluation**, and produces **automated outputs** (an AI brief,
a structured recommendation, and notification/audit events) for a human to approve.

Humans stay in the loop: the agents never silently resolve or close a ticket — they
only draft responses and suggest category/priority, which support staff explicitly
approve or reject.

---

## 1. What this project delivers (rubric mapping)

This project targets the Week 6 Final Project rubric. Each objective maps to concrete
code:

| # | Rubric objective | Where it lives |
|---|------------------|----------------|
| 1 | **Data Retrieval** (PDFs, DBs, APIs) | `lib/ai/retrieval/pdf.ts` (PDF/TXT/MD knowledge base via `pdf-parse`), `lib/ai/retrieval/tickets.ts` (PostgreSQL historical tickets via Prisma), `lib/ai/providers/ollama.ts` (LLM HTTP API) |
| 2 | **Data Processing & Summarization** (LLMs) | `lib/ai/agents/*` — `triage`, `knowledge` (summarization + citations), `resolution` (draft reply) |
| 3 | **Automated Actions** (reports, dashboards, notifications) | `lib/ai/orchestrator.ts` writes `AgentReport` + `AiRecommendation`; `lib/notifications/` fans out to audit log + **SMTP email** + **HTTP webhook**; `/agents` + `/manager/summary` dashboards |
| 4 | **Workflow Orchestration** (parallel + sequential) | `lib/ai/orchestrator.ts` — parallel retrieval, then sequential triage → knowledge → resolution → evaluator, with per-step persistence |
| 5 | **Presentation & Explanation** | This README, the [`docs/`](./docs/) folder, and the Streamlit demo (`streamlit_app.py`) |
| 6 | **Testing & Evaluation** | `vitest` unit/route tests, Python `unittest` for the demo core, and a golden-set eval harness (`lib/ai/eval/run-eval.ts`) with pass/fail thresholds |

Full write-ups live in **[`docs/`](./docs/)**:
[Architecture](./docs/architecture.md) ·
[Endpoints](./docs/endpoints.md) ·
[Data](./docs/data.md) ·
[Agents](./docs/agents.md) ·
[Notifications](./docs/notifications.md) ·
[Setup](./docs/setup.md)

---

## 2. Architecture

Two runnable surfaces share the same multi-agent design:

1. **Full-stack Next.js app** (`app/`, `lib/`, `prisma/`) — production-shaped, with
   PostgreSQL, authentication, role-based access, and a real knowledge base.
2. **Standalone Streamlit demo** (`streamlit_app.py`, `streamlit_demo/`) — a
   zero-infrastructure demo of the identical agent pipeline for presentations.

### Multi-agent pipeline

```
                    ┌─────────────────────────────────────────┐
   New / selected   │            ORCHESTRATOR                  │
      ticket  ─────▶│   (lib/ai/orchestrator.ts)               │
                    │                                          │
                    │  Stage 1 — RETRIEVAL (parallel)          │
                    │    ├─ retriever_db   (similar tickets)   │
                    │    └─ retriever_pdf  (handbook chunks)   │
                    │                                          │
                    │  Stage 2 — REASONING (sequential)        │
                    │    triage ─▶ knowledge ─▶ resolution     │
                    │                    │                     │
                    │  Stage 3 — GUARDRAIL                     │
                    │    └─ evaluator (approve / flag)         │
                    │                                          │
                    │  Stage 4 — AUTOMATED OUTPUTS             │
                    │    ├─ AiRecommendation (category/draft)  │
                    │    ├─ AgentReport      (markdown brief)  │
                    │    └─ notify() → log + email + webhook   │
                    └─────────────────────────────────────────┘
                                      │
                                      ▼
                        Human approve / reject (support)
```

Each agent returns **strict JSON** validated with Zod (`lib/ai/types.ts`,
`lib/ai/parse.ts`), so malformed model output fails fast instead of corrupting the
pipeline. Every step is persisted to `AgentStep` with inputs, outputs, evidence,
status, and duration for full observability.

### The agents

| Agent | Responsibility | Output schema |
|-------|----------------|---------------|
| `retriever_db` | Rank historical tickets by token overlap | `RetrievalHit[]` |
| `retriever_pdf` | Rank knowledge-base chunks (from PDFs/TXT) | `RetrievalHit[]` |
| `triage` | Classify category + priority | `TriageOutput` |
| `knowledge` | Summarize handbook guidance with citations | `KnowledgeOutput` |
| `resolution` | Draft a reply + recommended actions | `ResolutionOutput` |
| `evaluator` | Safety / usefulness guardrail | `EvaluatorOutput` |

### LLM provider abstraction

`getLlmProvider()` (`lib/ai/providers/index.ts`) selects a backend:

- **`ollama`** — local models (default `qwen2.5:7b`) with timeout + retry/backoff.
- **`mock`** — a deterministic offline provider so tests, CI, and demos always work
  without a GPU or network.
- **`auto`** (default) — use Ollama if reachable, otherwise fall back to mock.

---

## 3. Tech stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS 4**
- **Prisma 7** + **PostgreSQL 16**
- **NextAuth 5** (credentials, role-based: `EMPLOYEE` / `STAFF` / `MANAGER`)
- **Zod 4** for schema validation
- **pdf-parse** for PDF ingestion
- **Vitest** + **@testing-library/react** for tests
- **Streamlit** (Python) for the standalone demo

---

## 4. Getting started (Next.js app)

### Prerequisites
- Node.js 20+ and npm
- Docker (for PostgreSQL, and optionally Ollama)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then set AUTH_SECRET (e.g. `openssl rand -base64 32`)

# 3. Start PostgreSQL (and optionally Ollama)
npm run db:up

# 4. Apply the schema and seed demo data
npm run db:migrate
npm run db:seed

# 5. Run the app
npm run dev
```

Open http://localhost:3000. Seeded accounts (password `password123`):

| Role | Email |
|------|-------|
| Employee | `employee@helpdesk.local` |
| Staff (support) | `staff@helpdesk.local` |
| Manager | `manager@helpdesk.local` |

### Optional: run real LLMs with Ollama

```bash
docker compose up -d ollama
docker exec -it $(docker ps -qf name=ollama) ollama pull qwen2.5:7b
# .env already points AI_PROVIDER="auto" at http://127.0.0.1:11434
```

Without Ollama the app automatically uses the deterministic mock provider.

### Optional: email + webhook notifications

```bash
# in .env — see .env.example and docs/notifications.md
SMTP_HOST=smtp.example.com
SMTP_FROM="HelpDesk Lite <noreply@example.com>"
NOTIFY_EMAIL_TO=staff@helpdesk.local
WEBHOOK_URL=https://hooks.example.com/helpdesk
WEBHOOK_SECRET=optional-shared-secret
```

When unset, notifications still write to `NotificationLog` and the console.

---

## 5. Standalone Streamlit demo

A no-database demo of the same pipeline, ideal for the presentation video:

```bash
pip install -r requirements-streamlit.txt
streamlit run streamlit_app.py
```

Switch between **Employee**, **Support**, and **Manager** roles in the sidebar to
submit tickets, run the multi-agent assist, approve/reject recommendations, and view
manager dashboards with run metrics.

---

## 6. Testing & evaluation

```bash
# TypeScript unit + API route tests (Vitest)
npm test

# Python demo-core tests
python3 -m unittest streamlit_demo.test_core -v

# Golden-set evaluation harness (accuracy / valid-output / completion rates)
npm run eval            # mock provider
npm run eval:qwen       # real Ollama model

# Lint and production build
npm run lint
npm run build
```

The eval harness (`lib/ai/eval/run-eval.ts`) runs the full multi-step pipeline over a
labeled golden set (`lib/ai/eval/golden.ts`) and **fails** if category accuracy,
valid-JSON rate, or multi-step completion rate fall below configurable thresholds
(`EVAL_MIN_ACCURACY`, `EVAL_MIN_VALID_RATE`, `EVAL_MIN_COMPLETION_RATE`). It writes a
machine-readable `evaluation-report.json` for evidence.

### Current status
- Vitest: **50 tests passing**
- Python: **4 tests passing**
- Eval (mock): **100%** category accuracy / valid-output / completion
- `npm run lint` and `npm run build`: clean

---

## 7. Project structure

```
app/                      Next.js routes (pages + API)
  api/agents/run          Trigger the multi-agent orchestrator
  api/agents/metrics      Reliability metrics for dashboards
  api/agents/recommendations/[id]  Human approve/reject
  api/knowledge           Upload PDFs/TXT into the knowledge base
lib/ai/
  orchestrator.ts         Pipeline coordinator (parallel + sequential)
  agents/                 triage / knowledge / resolution / evaluator
  retrieval/              pdf + tickets retrievers, chunking
  providers/              ollama / mock provider abstraction
  eval/                   golden set + eval harness
lib/notifications/        Audit log + SMTP email + HTTP webhook
docs/                     Architecture, endpoints, data, agents, setup
prisma/                   schema, migrations, seed data
streamlit_app.py          Standalone demo UI
streamlit_demo/core.py    Demo pipeline + tests
```

---

## 8. Design decisions & safety

- **Human-in-the-loop by default.** Agents draft and suggest; only support staff can
  change ticket status. Approving a recommendation applies category/priority metadata
  only — it never auto-resolves or closes tickets.
- **Structured, validated I/O.** Every agent output is Zod-validated JSON, making the
  pipeline robust to noisy LLM responses.
- **Full auditability.** Runs, steps, recommendations, reports, and notifications are
  all persisted, so every automated action is traceable.
- **Multi-channel notifications.** `notify()` always audits to the DB, then optionally
  emails via SMTP and POSTs to a webhook — sink failures never break the main flow.
- **Graceful degradation.** Retrieval uses `Promise.allSettled` and the provider layer
  falls back to a deterministic mock, so the system stays usable offline.
