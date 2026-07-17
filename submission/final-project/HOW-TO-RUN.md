# How to run HelpDesk Lite

## Quick start

```bash
cp .env.example .env
npm install
npm run db:up          # postgres + redis + mailpit + webhook (not Ollama)
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3000
```

### Ollama on GPU (optional, for real LLM / `eval:qwen`)

```bash
# One-time: ./scripts/install-nvidia-container-toolkit.sh
docker compose --profile gpu up -d ollama
docker exec -it $(docker ps -qf name=ollama) ollama pull qwen2.5:7b
# Confirm GPU: curl -s http://127.0.0.1:11434/api/ps  → size_vram > 0
```

Demo accounts (password `password123`):
- Employee: employee@helpdesk.local
- Staff: staff@helpdesk.local
- Manager: manager@helpdesk.local

## Notifications for the demo video

- Mailpit inbox: http://127.0.0.1:8025
- Webhook echo: http://127.0.0.1:8089/
- Smoke: `npm run smoke:notify`

## Evaluation evidence

```bash
npm run eval           # mock provider
npm run eval:qwen      # local Ollama qwen2.5:7b (GPU)
```

Reports are copied into this folder as `evaluation-report*.json`.

## Streamlit demo (optional)

```bash
pip install -r requirements-streamlit.txt
streamlit run streamlit_app.py
```
