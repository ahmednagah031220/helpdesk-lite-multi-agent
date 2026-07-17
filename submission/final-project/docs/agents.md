# Agents

Orchestrator: `lib/ai/orchestrator.ts`.
Schemas: `lib/ai/types.ts` (Zod).
JSON parse helper: `lib/ai/parse.ts`.

## Execution order

| Stage | Mode | Steps |
|-------|------|-------|
| 1 | **Parallel** | `retriever_db`, `retriever_pdf` |
| 2 | Sequential | `triage` → `knowledge` → `resolution` |
| 3 | Sequential | `evaluator` |
| 4 | Side effects | create recommendation + report; `notify()` |

If either retrieval rejects, the run is marked `FAILED`.
If any LLM agent throws (including Zod parse failure), the step is recorded
as `FAILED` and the run fails.

## Agent contracts

### retriever_db
- **Code:** `lib/ai/retrieval/tickets.ts`
- **Input:** ticket id, title, description
- **Output:** `RetrievalHit[]` (similar historical tickets)

### retriever_pdf
- **Code:** `lib/ai/retrieval/pdf.ts`
- **Input:** title, description
- **Output:** `RetrievalHit[]` from `KnowledgeChunk`

### triage
- **Code:** `lib/ai/agents/triage.ts`
- **Uses:** similar tickets as evidence
- **Output:**
  ```ts
  {
    category: "IT" | "HR" | "FACILITIES" | "OTHER",
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    confidence: number, // 0..1
    rationale: string,
    tags: string[]
  }
  ```

### knowledge
- **Code:** `lib/ai/agents/knowledge.ts`
- **Uses:** PDF/handbook hits
- **Output:**
  ```ts
  {
    relevant: boolean,
    summary: string,
    citations: { documentTitle, excerpt, score }[],
    suggestedSteps: string[]
  }
  ```

### resolution
- **Code:** `lib/ai/agents/resolution.ts`
- **Uses:** triage + knowledge
- **Output:**
  ```ts
  {
    draftResponse: string,
    recommendedActions: string[],
    needsHumanReview: boolean,
    confidence: number
  }
  ```

### evaluator
- **Code:** `lib/ai/agents/evaluator.ts`
- **Uses:** triage + knowledge + resolution
- **Output:**
  ```ts
  {
    approved: boolean,
    issues: string[],
    confidence: number,
    notes: string
  }
  ```

## Recommendation merge rules

- `confidence` = min(triage, resolution, evaluation)
- `needsHumanReview` = resolution flag **or** evaluator not approved
- Approving a recommendation may apply category/priority; it never changes
  ticket status.

## Evaluation harness

`npm run eval` runs the agent chain over `lib/ai/eval/golden.ts` and writes
`evaluation-report.json` with accuracy / valid-output / completion rates.
Thresholds are env-configurable (`EVAL_MIN_*`).
