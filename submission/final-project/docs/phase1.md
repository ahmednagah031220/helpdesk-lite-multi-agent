# Phase 1 — Tenancy, queue, SSO, vector KB

This phase hardens HelpDesk Lite toward multi-company deployment.

## 1. Organization tenancy

- `Organization` model (`slug` unique)
- `orgId` on users, tickets, knowledge docs, notifications
- Email uniqueness is **per org** (`@@unique([orgId, email])`)
- All list/detail APIs and pages filter by the signed-in user's `orgId`
- Seed org: **Acme Corp** (`acme`)

## 2. Durable agent job queue

- Redis + **BullMQ** (`lib/queue/agent-queue.ts`)
- `POST /api/agents/run` enqueues a job when Redis is up (`queue: "redis"`)
- Worker: `npm run worker`
- Automatic fallback to Next.js `after()` when Redis is down (`queue: "inline"`)

```bash
npm run db:up          # includes redis
npm run worker         # separate terminal
npm run dev
```

## 3. SSO (Google)

- Credentials login remains for demos
- When `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set, `/login` shows **Continue with Google SSO**
- First Google login creates an `EMPLOYEE` in `DEFAULT_ORG_SLUG` (default `acme`)
- Existing org members are linked by email

## 4. Vector knowledge base

- Postgres image: `pgvector/pgvector:pg16`
- `KnowledgeChunk.embedding vector(384)` + HNSW index
- Embeddings via Ollama (`EMBEDDING_MODEL`, default `nomic-embed-text`) or deterministic **local** vectors (`EMBEDDING_PROVIDER=local`)
- Hybrid retrieval: ~45% BM25-lite + ~55% cosine similarity, org-scoped

```bash
# optional real embeddings
ollama pull nomic-embed-text
# EMBEDDING_PROVIDER=auto (default attempt) or leave local for CI
```

## Ops checklist

| Concern | How |
|---------|-----|
| Migrate | `npm run db:migrate` |
| Seed | `npm run db:seed` (embeds handbook locally) |
| Queue health | Redis on `:6379`, worker process running |
| SSO | Set Google OAuth client for `http://localhost:3000/api/auth/callback/google` |
| Ollama GPU | `./scripts/install-nvidia-container-toolkit.sh` then `docker compose --profile gpu up -d ollama` (see `docs/setup.md`) |
