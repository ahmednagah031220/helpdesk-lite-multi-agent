# Data model

Source of truth: `prisma/schema.prisma`. Database: PostgreSQL 16
(Docker Compose service on host port **5433**).

## Entity overview

```
User ─┬─< Ticket (submitter)
      ├─< Ticket (assignee)
      ├─< AgentRun (triggeredBy)
      └─< AiRecommendation (decidedBy)

Ticket ─┬─< StatusEvent
        └─< AgentRun ─┬─< AgentStep
                      ├─ AiRecommendation (1:1)
                      └─ AgentReport (1:1)

KnowledgeDocument ─< KnowledgeChunk

NotificationLog (standalone audit of automated actions)
```

## Core models

### User
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| name, email | string | email unique |
| password | string | bcrypt hash |
| role | `EMPLOYEE` \| `STAFF` \| `MANAGER` | |

### Ticket
| Field | Type | Notes |
|-------|------|-------|
| title, description | string | |
| category | `IT` \| `HR` \| `FACILITIES` \| `OTHER` | |
| status | `OPEN` \| `IN_PROGRESS` \| `RESOLVED` \| `CLOSED` | default OPEN |
| priority | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` \| null | AI may suggest |
| submitterId / assigneeId | FK → User | |

### StatusEvent
Audit trail of status transitions (`fromStatus` → `toStatus`).

### KnowledgeDocument / KnowledgeChunk
Uploaded handbook content. PDFs are text-extracted with `pdf-parse`, then split
by `chunkText()` (~700 chars, 80 overlap). Retrieval ranks chunks by token
overlap against the ticket text.

### AgentRun
One execution of the multi-agent pipeline for a ticket.

| Field | Notes |
|-------|-------|
| status | `PENDING` \| `RUNNING` \| `SUCCEEDED` \| `FAILED` |
| provider / model | e.g. `ollama:qwen2.5:7b` or `mock` |
| durationMs, error | timing + failure message |

### AgentStep
Per-agent record: `name`, `status`, JSON `input` / `output` / `evidence`,
`durationMs`.

Step names: `retriever_db`, `retriever_pdf`, `triage`, `knowledge`,
`resolution`, `evaluator`.

### AiRecommendation
Structured suggestion produced at the end of a successful run.

| Field | Notes |
|-------|-------|
| suggestedCategory / suggestedPriority | Applied only on human APPROVED |
| draftResponse, recommendedActions | For staff review |
| confidence, needsHumanReview, citations | |
| decision | `PENDING` \| `APPROVED` \| `REJECTED` |

### AgentReport
Markdown AI brief + JSON metrics (latency, hit counts, evaluator result).

### NotificationLog
Every `notify()` call writes one row (`event`, `ticketId`, JSON `payload`)
before optional email/webhook delivery.

## Seed data

`npm run db:seed` loads (`prisma/seed.ts`):

- **Users** (password `password123`):
  - `employee@helpdesk.local` (+ dan, eva, frank, grace)
  - `staff@helpdesk.local` (+ helen, ian)
  - `manager@helpdesk.local`
- **Tickets** across all statuses/categories for demos
- **Knowledge**: Internal Support Handbook (chunked)

## Retrieval data flow

1. Ticket title + description tokenized
2. Score overlap against recent tickets / knowledge chunks
3. Top-N hits become **evidence** for triage and knowledge agents

No vector DB is required for the default path; ranking uses **BM25-lite**
token scoring (`lib/ai/retrieval/score.ts`) with stopword filtering and title
boost. This stays deterministic for tests while ranking more usefully than raw
overlap.
