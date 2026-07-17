import { describe, expect, it } from "vitest";
import { extractJsonObject, parseModelJson } from "@/lib/ai/parse";
import { TriageOutputSchema } from "@/lib/ai/types";

describe("extractJsonObject", () => {
  it("parses plain JSON", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("extracts JSON from prose wrapper", () => {
    const text = 'Here is the result:\n{"category":"IT","priority":"HIGH","confidence":0.9,"rationale":"wifi","tags":["it"]}\nThanks';
    expect(extractJsonObject(text)).toMatchObject({ category: "IT" });
  });
});

describe("parseModelJson", () => {
  it("validates triage schema", () => {
    const parsed = parseModelJson(
      JSON.stringify({
        category: "IT",
        priority: "MEDIUM",
        confidence: 0.8,
        rationale: "network keywords",
        tags: ["wifi"],
      }),
      TriageOutputSchema,
    );
    expect(parsed.category).toBe("IT");
  });

  it("rejects invalid confidence", () => {
    expect(() =>
      parseModelJson(
        JSON.stringify({
          category: "IT",
          priority: "MEDIUM",
          confidence: 2,
          rationale: "bad",
          tags: [],
        }),
        TriageOutputSchema,
      ),
    ).toThrow();
  });
});
