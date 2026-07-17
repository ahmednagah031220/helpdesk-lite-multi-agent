/**
 * Smoke-test local Ollama + configured model.
 * Exits 0 even when Ollama is unavailable if ALLOW_MOCK_FALLBACK=1 (CI-friendly).
 */
import "dotenv/config";
import { createOllamaProvider, isOllamaAvailable } from "@/lib/ai/providers/ollama";

async function main() {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
  const allowFallback = process.env.ALLOW_MOCK_FALLBACK === "1";

  console.log(`Checking Ollama at ${baseUrl} (model=${model})`);
  const up = await isOllamaAvailable(baseUrl);
  if (!up) {
    console.error("Ollama is not reachable.");
    if (allowFallback) {
      console.log("ALLOW_MOCK_FALLBACK=1 — treating as soft pass (use mock provider).");
      process.exit(0);
    }
    process.exit(1);
  }

  const provider = createOllamaProvider({ baseUrl, model });
  const content = await provider.complete([
    {
      role: "system",
      content:
        'Return ONLY JSON: {"ok":true,"model":"string"} confirming you can answer.',
    },
    { role: "user", content: "Reply with ok=true and your model name." },
  ]);

  console.log("Ollama response:", content.slice(0, 300));
  console.log("Local model smoke test PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
