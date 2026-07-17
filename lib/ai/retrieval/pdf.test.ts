import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/ai/retrieval/chunk";

describe("chunkText", () => {
  it("returns empty for blank input", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("chunks long text with overlap", () => {
    const text = "a".repeat(1500);
    const chunks = chunkText(text, 700, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBe(700);
    expect(chunks[1].startsWith("a".repeat(80))).toBe(true);
  });

  it("keeps short text as one chunk", () => {
    expect(chunkText("hello handbook")).toEqual(["hello handbook"]);
  });
});
