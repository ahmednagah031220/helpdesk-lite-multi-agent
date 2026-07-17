# Setup

## Prerequisites

- Node.js 20+
- Docker (PostgreSQL; optional Ollama)
- NVIDIA GPU + drivers (`nvidia-smi`) for real LLM inference
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) for Docker GPU Ollama (or use host Ollama)
- Python 3.10+ (Streamlit demo only)

## Next.js app

```bash
npm install
cp .env.example .env
# set AUTH_SECRET, e.g. openssl rand -base64 32

npm run db:up          # postgres (pgvector) + redis + mailpit + webhook (not Ollama)
npm run db:migrate
npm run db:seed
npm run worker         # BullMQ agent worker (separate terminal)
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

## Optional: Ollama LLM (GPU)

Run models on the NVIDIA GPU (`size_vram > 0`), not CPU. The Compose `ollama` service is behind profile `gpu` so `npm run db:up` does not start a CPU-only container.

### Recommended: Docker Ollama with GPU

One-time toolkit install (Ubuntu/Debian; needs sudo):

```bash
./scripts/install-nvidia-container-toolkit.sh
# or follow: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
```

Then start Ollama on the GPU:

```bash
docker compose --profile gpu up -d ollama
docker exec -it $(docker ps -qf name=ollama) ollama pull qwen2.5:7b
```

Verify GPU inside Docker:

```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
curl -s http://127.0.0.1:11434/api/ps   # after a generate: size_vram > 0
nvidia-smi                              # llama-server / ollama using VRAM
```

Leave `AI_PROVIDER=auto` to use Ollama when available, otherwise mock.

### Alternative: host Ollama (no Docker toolkit)

```bash
# One-time: install binary + CUDA libs into ~/.local
curl -fsSL https://ollama.com/download/ollama-linux-amd64.tar.zst \
  | tar -I zstd -x -C "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/lib/ollama:$HOME/.local/lib/ollama/cuda_v13:${LD_LIBRARY_PATH:-}"

# Free :11434 if a Docker Ollama is running
docker compose --profile gpu stop ollama 2>/dev/null || true

ollama serve   # logs should show library=CUDA and your GPU name
ollama pull qwen2.5:7b
```

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
| `npm run worker` | BullMQ worker for durable agent jobs |
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
