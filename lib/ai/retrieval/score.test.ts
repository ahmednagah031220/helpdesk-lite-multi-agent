import { describe, expect, it } from "vitest";
import { scoreRelevance, tokenize } from "@/lib/ai/retrieval/score";

describe("retrieval score", () => {
  it("drops stopwords while tokenizing", () => {
    expect(tokenize("the wifi and the laptop")).toEqual(["wifi", "laptop"]);
  });

  it("ranks a closer candidate higher than an unrelated one", () => {
    const query = "office wifi laptop disconnect";
    const strong = scoreRelevance({
      query,
      candidate: "Office wifi laptop disconnect restart adapter",
      title: "WiFi disconnect",
      corpusDocs: [
        "Office wifi laptop disconnect restart adapter",
        "Missing March payslip in portal",
      ],
    });
    const weak = scoreRelevance({
      query,
      candidate: "Missing March payslip in portal",
      title: "Payslip",
      corpusDocs: [
        "Office wifi laptop disconnect restart adapter",
        "Missing March payslip in portal",
      ],
    });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeGreaterThan(0.1);
  });
});
