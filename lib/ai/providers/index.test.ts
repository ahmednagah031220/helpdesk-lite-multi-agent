import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  mockProvider: { name: "mock", complete: vi.fn() },
  ollamaProvider: { name: "ollama:qwen-test", complete: vi.fn() },
}));

vi.mock("@/lib/ai/providers/mock", () => ({
  createMockProvider: () => mocks.mockProvider,
}));

vi.mock("@/lib/ai/providers/ollama", () => ({
  createOllamaProvider: () => mocks.ollamaProvider,
  isOllamaAvailable: mocks.isAvailable,
}));

import { getLlmProvider } from "@/lib/ai/providers";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AI_PROVIDER;
});

describe("provider selection", () => {
  it("honors an explicitly forced provider", async () => {
    await expect(getLlmProvider("mock")).resolves.toBe(mocks.mockProvider);
    await expect(getLlmProvider("ollama")).resolves.toBe(mocks.ollamaProvider);
  });

  it("uses Ollama in auto mode when available", async () => {
    mocks.isAvailable.mockResolvedValue(true);
    await expect(getLlmProvider()).resolves.toBe(mocks.ollamaProvider);
  });

  it("falls back deterministically to mock when Ollama is offline", async () => {
    mocks.isAvailable.mockResolvedValue(false);
    await expect(getLlmProvider()).resolves.toBe(mocks.mockProvider);
  });
});
