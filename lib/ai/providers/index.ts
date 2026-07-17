import { createMockProvider } from "@/lib/ai/providers/mock";
import { createOllamaProvider, isOllamaAvailable } from "@/lib/ai/providers/ollama";
import type { LlmProvider } from "@/lib/ai/types";

export async function getLlmProvider(force?: "mock" | "ollama"): Promise<LlmProvider> {
  const preferred = force ?? (process.env.AI_PROVIDER as "mock" | "ollama" | undefined) ?? "auto";

  if (preferred === "mock") {
    return createMockProvider();
  }

  if (preferred === "ollama") {
    return createOllamaProvider();
  }

  // auto
  if (await isOllamaAvailable()) {
    return createOllamaProvider();
  }

  return createMockProvider();
}

export { createMockProvider, createOllamaProvider, isOllamaAvailable };
