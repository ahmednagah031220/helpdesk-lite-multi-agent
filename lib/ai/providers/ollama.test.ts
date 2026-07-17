import { afterEach, describe, expect, it, vi } from "vitest";
import { createOllamaProvider, isOllamaAvailable } from "@/lib/ai/providers/ollama";

const messages = [{ role: "user" as const, content: "hello" }];

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Ollama provider", () => {
  it("sends structured chat requests and returns model content", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ message: { content: '{"ok":true}' } }),
        { status: 200 },
      ),
    );
    const provider = createOllamaProvider({
      baseUrl: "http://ollama.test/",
      model: "qwen-test",
      maxRetries: 0,
    });

    await expect(provider.complete(messages, { temperature: 0.1 })).resolves.toBe(
      '{"ok":true}',
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://ollama.test/api/chat");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "qwen-test",
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
    });
  });

  it("retries transient server errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: '{"ok":true}' }), {
          status: 200,
        }),
      );
    const provider = createOllamaProvider({
      maxRetries: 1,
      retryDelayMs: 0,
    });

    await expect(provider.complete(messages)).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent client errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("bad request", { status: 400 }));
    const provider = createOllamaProvider({
      maxRetries: 2,
      retryDelayMs: 0,
    });

    await expect(provider.complete(messages)).rejects.toThrow("Ollama error 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts a timed-out request", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    const provider = createOllamaProvider({
      timeoutMs: 5,
      maxRetries: 0,
    });

    await expect(provider.complete(messages)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("reports availability without throwing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockRejectedValueOnce(new Error("offline"));

    await expect(isOllamaAvailable("http://ollama.test")).resolves.toBe(true);
    await expect(isOllamaAvailable("http://ollama.test")).resolves.toBe(false);
  });
});
