# Setup

## Prerequisites

- Node.js 20+
- Docker (PostgreSQL; optional Ollama)
- Python 3.10+ (Streamlit demo only)

## Next.js app

```bash
npm install
cp .env.example .env
# set AUTH_SECRET, e.g. openssl rand -base64 32

npm run db:up          # postgres + ollama + mailpit + webhook echo
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3000
```

Demo logins (password `password123`):

| Role | Email |
|------|-------|
| Employee | `employee@helpdesk.local` |
| Staff | `staff@helpdesk.local` |
| Manager | `manager@helpdesk.local` |

Notification UIs after `db:up`:

- Mailpit: http://127.0.0.1:8025
- Webhook echo: http://127.0.0.1:8089/

## Optional: Ollama LLM

```bash
docker compose up -d ollama
docker exec -it $(docker ps -qf name=ollama) ollama pull qwen2.5:7b
```

Leave `AI_PROVIDER=auto` to use Ollama when available, otherwise mock.

## Streamlit demo

```bash
pip install -r requirements-streamlit.txt
streamlit run streamlit_app.py
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm test` | Vitest unit + route tests |
| `npm run eval` | Golden-set evaluation (mock) |
| `npm run eval:qwen` | Evaluation against Ollama |
| `npm run smoke:e2e` | DB agent run + notify smoke |
| `npm run smoke:notify` | Email + webhook only |
| `npm run pack:submission` | Copy docs + reports into submission pack |
| `npm run lint` | ESLint |
| `npm run build` | Prisma generate + Next production build |
| `npm run smoke:agents` | Smoke run against DB |
| `npm run smoke:ollama` | Smoke Ollama connectivity |

Python:

```bash
python3 -m unittest streamlit_demo.test_core -v
```

## Notes

- Next.js 16 may warn that the `middleware` file convention is deprecated in
  favor of `proxy`. Auth still uses `middleware.ts` with NextAuth; leave it
  until NextAuth documents the proxy migration.
- `npm audit` may report transitive advisories in `next` / `next-auth`. Do
  **not** run `npm audit fix --force` — it can downgrade Next to an incompatible
  major. Prefer staying on current patched minors.
