import type { LlmMessage, LlmProvider } from "@/lib/ai/types";

export type OllamaOptions = {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

class OllamaRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function wait(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function createOllamaProvider(options: OllamaOptions = {}): LlmProvider {
  const baseUrl = (options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(
    /\/$/,
    "",
  );
  const model = options.model ?? process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
  const timeoutMs = options.timeoutMs ?? Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000);
  const maxRetries = options.maxRetries ?? Number(process.env.OLLAMA_MAX_RETRIES ?? 2);
  const retryDelayMs =
    options.retryDelayMs ?? Number(process.env.OLLAMA_RETRY_DELAY_MS ?? 250);

  return {
    name: `ollama:${model}`,
    async complete(messages: LlmMessage[], opts) {
      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              model,
              stream: false,
              format: "json",
              options: {
                temperature: opts?.temperature ?? 0.2,
              },
              messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          });

          if (!response.ok) {
            const body = await response.text();
            const error = new OllamaRequestError(
              `Ollama error ${response.status}: ${body.slice(0, 300)}`,
              isRetryableStatus(response.status),
            );
            if (!error.retryable || attempt === maxRetries) {
              throw error;
            }
            lastError = error;
          } else {
            const data = (await response.json()) as {
              message?: { content?: string };
              response?: string;
            };
            const content = data.message?.content ?? data.response;
            if (!content?.trim()) {
              throw new Error("Ollama returned empty content");
            }
            return content.trim();
          }
        } catch (error) {
          lastError = error;
          if (
            attempt === maxRetries ||
            (error instanceof OllamaRequestError && !error.retryable)
          ) {
            throw error;
          }
        } finally {
          clearTimeout(timer);
        }

        await wait(retryDelayMs * 2 ** attempt);
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("Ollama request failed");
    },
  };
}

export async function isOllamaAvailable(baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434") {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
