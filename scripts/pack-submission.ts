import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import path from "path";

const root = process.cwd();
const outDir = path.resolve(root, "submission/final-project");
const parentOut = path.resolve(root, "../submission/final-project");

function copyInto(target: string) {
  mkdirSync(target, { recursive: true });
  cpSync(path.join(root, "README.md"), path.join(target, "README.md"));
  cpSync(path.join(root, "docs"), path.join(target, "docs"), { recursive: true });
  cpSync(path.join(root, ".env.example"), path.join(target, "env.example.txt"));

  const howToRun = `# How to run HelpDesk Lite

## Quick start

\`\`\`bash
cp .env.example .env
npm install
npm run db:up          # postgres + ollama + mailpit + webhook echo
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3000
\`\`\`

Demo accounts (password \`password123\`):
- Employee: employee@helpdesk.local
- Staff: staff@helpdesk.local
- Manager: manager@helpdesk.local

## Notifications for the demo video

- Mailpit inbox: http://127.0.0.1:8025
- Webhook echo: http://127.0.0.1:8089/
- Smoke: \`npm run smoke:notify\`

## Evaluation evidence

\`\`\`bash
npm run eval           # mock provider
npm run eval:qwen      # local Ollama qwen2.5:7b
\`\`\`

Reports are copied into this folder as \`evaluation-report*.json\`.

## Streamlit demo (optional)

\`\`\`bash
pip install -r requirements-streamlit.txt
streamlit run streamlit_app.py
\`\`\`
`;
  writeFileSync(path.join(target, "HOW-TO-RUN.md"), howToRun);

  // Copy any local evaluation reports into the pack
  const reportDirs = [
    path.join(root, "submission/final-project"),
    path.resolve(root, "../submission/final-project"),
  ];
  for (const dir of reportDirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.startsWith("evaluation-report") || !file.endsWith(".json")) {
        continue;
      }
      const src = path.join(dir, file);
      const dest = path.join(target, file);
      if (src !== dest) {
        writeFileSync(dest, readFileSync(src));
      }
    }
  }
}

copyInto(outDir);
copyInto(parentOut);
console.log(`Submission pack ready:`);
console.log(`  ${outDir}`);
console.log(`  ${parentOut}`);
