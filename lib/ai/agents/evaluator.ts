import { parseModelJson } from "@/lib/ai/parse";
import type {
  EvaluatorOutput,
  KnowledgeOutput,
  LlmProvider,
  ResolutionOutput,
  TriageOutput,
} from "@/lib/ai/types";
import { EvaluatorOutputSchema } from "@/lib/ai/types";

export async function runEvaluatorAgent(input: {
  provider: LlmProvider;
  triage: TriageOutput;
  knowledge: KnowledgeOutput;
  resolution: ResolutionOutput;
}): Promise<EvaluatorOutput> {
  const content = await input.provider.complete([
    {
      role: "system",
      content:
        "You are the evaluator/guardrail agent. Check safety, usefulness, and consistency. Return ONLY JSON matching: {approved: boolean, issues: string[], confidence: number, notes: string}",
    },
    {
      role: "user",
      content: `Evaluate this multi-agent output:\nTriage: ${JSON.stringify(input.triage)}\nKnowledge: ${JSON.stringify(input.knowledge)}\nResolution: ${JSON.stringify(input.resolution)}`,
    },
  ]);

  return parseModelJson(content, EvaluatorOutputSchema);
}
