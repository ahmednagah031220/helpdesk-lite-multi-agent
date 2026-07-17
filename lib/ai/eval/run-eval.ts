import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { runEvaluatorAgent } from "@/lib/ai/agents/evaluator";
import { runKnowledgeAgent } from "@/lib/ai/agents/knowledge";
import { runResolutionAgent } from "@/lib/ai/agents/resolution";
import { getLlmProvider } from "@/lib/ai/providers";
import { runTriageAgent } from "@/lib/ai/agents/triage";
import { GOLDEN_CASES } from "@/lib/ai/eval/golden";

async function main() {
  const providerName = process.env.EVAL_PROVIDER === "ollama" ? "ollama" : "mock";
  const provider = await getLlmProvider(providerName);
  const started = Date.now();
  let correct = 0;
  let valid = 0;
  let completed = 0;
  const rows: Array<Record<string, unknown>> = [];

  for (const testCase of GOLDEN_CASES) {
    const caseStart = Date.now();
    try {
      const triage = await runTriageAgent({
        provider,
        title: testCase.title,
        description: testCase.description,
        similarTickets: [],
      });
      valid += 1;
      const ok = triage.category === testCase.expectedCategory;
      if (ok) correct += 1;

      const knowledge = await runKnowledgeAgent({
        provider,
        title: testCase.title,
        description: testCase.description,
        pdfHits: [
          {
            id: `handbook-${testCase.id}`,
            title: "Internal Support Handbook",
            excerpt: "Follow the relevant internal support checklist and escalate when needed.",
            score: 0.8,
            sourceType: "pdf",
          },
        ],
      });
      const resolution = await runResolutionAgent({
        provider,
        title: testCase.title,
        description: testCase.description,
        triage,
        knowledge,
      });
      const evaluation = await runEvaluatorAgent({
        provider,
        triage,
        knowledge,
        resolution,
      });
      completed += 1;

      rows.push({
        id: testCase.id,
        expected: testCase.expectedCategory,
        predicted: triage.category,
        correct: ok,
        confidence: triage.confidence,
        multiStepCompleted: true,
        evaluatorApproved: evaluation.approved,
        durationMs: Date.now() - caseStart,
      });
    } catch (error) {
      rows.push({
        id: testCase.id,
        expected: testCase.expectedCategory,
        predicted: null,
        correct: false,
        multiStepCompleted: false,
        error: error instanceof Error ? error.message : "failed",
        durationMs: Date.now() - caseStart,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    provider: provider.name,
    total: GOLDEN_CASES.length,
    validOutputs: valid,
    validOutputRate: valid / GOLDEN_CASES.length,
    categoryAccuracy: correct / GOLDEN_CASES.length,
    successfulMultiStepCompletions: completed,
    multiStepCompletionRate: completed / GOLDEN_CASES.length,
    durationMs: Date.now() - started,
    cases: rows,
  };

  const outDir = path.resolve(process.cwd(), "../submission/final-project");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "evaluation-report.json");
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`Evaluation complete`);
  console.log(`  Cases: ${report.total}`);
  console.log(`  Valid output rate: ${(report.validOutputRate * 100).toFixed(1)}%`);
  console.log(`  Category accuracy: ${(report.categoryAccuracy * 100).toFixed(1)}%`);
  console.log(
    `  Multi-step completion rate: ${(report.multiStepCompletionRate * 100).toFixed(1)}%`,
  );
  console.log(`  Wrote ${outFile}`);

  const minimumAccuracy = Number(process.env.EVAL_MIN_ACCURACY ?? 0.7);
  const minimumValidRate = Number(process.env.EVAL_MIN_VALID_RATE ?? 0.8);
  const minimumCompletionRate = Number(
    process.env.EVAL_MIN_COMPLETION_RATE ?? 0.8,
  );
  if (
    report.categoryAccuracy < minimumAccuracy ||
    report.validOutputRate < minimumValidRate ||
    report.multiStepCompletionRate < minimumCompletionRate
  ) {
    throw new Error(
      "Evaluation thresholds failed: " +
        `accuracy>=${minimumAccuracy}, valid>=${minimumValidRate}, ` +
        `completion>=${minimumCompletionRate}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
