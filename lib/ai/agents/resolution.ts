import { parseModelJson } from "@/lib/ai/parse";
import type {
  KnowledgeOutput,
  LlmProvider,
  ResolutionOutput,
  TriageOutput,
} from "@/lib/ai/types";
import { ResolutionOutputSchema } from "@/lib/ai/types";

export async function runResolutionAgent(input: {
  provider: LlmProvider;
  title: string;
  description: string;
  triage: TriageOutput;
  knowledge: KnowledgeOutput;
}): Promise<ResolutionOutput> {
  const content = await input.provider.complete([
    {
      role: "system",
      content:
        "You are the resolution agent for HelpDesk Lite. Draft a helpful reply. Return ONLY JSON matching: {draftResponse: string, recommendedActions: string[], needsHumanReview: boolean, confidence: number}",
    },
    {
      role: "user",
      content: `Ticket: ${input.title}\n${input.description}\n\nTriage: ${JSON.stringify(input.triage)}\nKnowledge: ${JSON.stringify(input.knowledge)}\n\nDraft a response for staff to review.`,
    },
  ]);

  return parseModelJson(content, ResolutionOutputSchema);
}
