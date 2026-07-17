# How to run HelpDesk Lite

## Quick start

```bash
cp .env.example .env
npm install
npm run db:up          # postgres + ollama + mailpit + webhook echo
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3000
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
npm run eval:qwen      # local Ollama qwen2.5:7b
```

Reports are copied into this folder as `evaluation-report*.json`.

## Streamlit demo (optional)

```bash
pip install -r requirements-streamlit.txt
streamlit run streamlit_app.py
```
