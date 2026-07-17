import type { z } from "zod";

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error(`Model did not return JSON: ${trimmed.slice(0, 200)}`);
  }
}

export function parseModelJson<T>(text: string, schema: z.ZodType<T>): T {
  const raw = extractJsonObject(text);
  return schema.parse(raw);
}
