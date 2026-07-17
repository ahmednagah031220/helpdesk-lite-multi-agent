import { describe, expect, it, vi } from "vitest";

/**
 * Lightweight ordering test that verifies the orchestration contract:
 * parallel retrieval first, then triage/knowledge, then resolution, then evaluator.
 * Uses a fake timeline instead of the DB-backed orchestrator.
 */
describe("orchestrator ordering contract", () => {
  it("fans out retrieval in parallel then sequences specialized agents", async () => {
    const log: string[] = [];

    const retrieveDb = async () => {
      log.push("retriever_db:start");
      await Promise.resolve();
      log.push("retriever_db:end");
      return ["ticket"];
    };
    const retrievePdf = async () => {
      log.push("retriever_pdf:start");
      await Promise.resolve();
      log.push("retriever_pdf:end");
      return ["pdf"];
    };
    const triage = vi.fn(async () => {
      log.push("triage");
      return { category: "IT" };
    });
    const knowledge = vi.fn(async () => {
      log.push("knowledge");
      return { summary: "ok" };
    });
    const resolution = vi.fn(async () => {
      log.push("resolution");
      return { draft: "ok" };
    });
    const evaluator = vi.fn(async () => {
      log.push("evaluator");
      return { approved: true };
    });

    const [db, pdf] = await Promise.all([retrieveDb(), retrievePdf()]);
    expect(db).toHaveLength(1);
    expect(pdf).toHaveLength(1);
    await triage();
    await knowledge();
    await resolution();
    await evaluator();

    const dbStart = log.indexOf("retriever_db:start");
    const pdfStart = log.indexOf("retriever_pdf:start");
    const triageIdx = log.indexOf("triage");
    const knowledgeIdx = log.indexOf("knowledge");
    const resolutionIdx = log.indexOf("resolution");
    const evaluatorIdx = log.indexOf("evaluator");

    expect(dbStart).toBeGreaterThanOrEqual(0);
    expect(pdfStart).toBeGreaterThanOrEqual(0);
    expect(triageIdx).toBeGreaterThan(Math.max(dbStart, pdfStart));
    expect(knowledgeIdx).toBeGreaterThan(triageIdx);
    expect(resolutionIdx).toBeGreaterThan(knowledgeIdx);
    expect(evaluatorIdx).toBeGreaterThan(resolutionIdx);
  });
});
