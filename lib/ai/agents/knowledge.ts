import { parseModelJson } from "@/lib/ai/parse";
import type { KnowledgeOutput, LlmProvider, RetrievalHit } from "@/lib/ai/types";
import { KnowledgeOutputSchema } from "@/lib/ai/types";

export async function runKnowledgeAgent(input: {
  provider: LlmProvider;
  title: string;
  description: string;
  pdfHits: RetrievalHit[];
}): Promise<KnowledgeOutput> {
  const docs = input.pdfHits
    .map((h, i) => `${i + 1}. ${h.title} (score=${h.score.toFixed(2)}): ${h.excerpt}`)
    .join("\n");

  const content = await input.provider.complete([
    {
      role: "system",
      content:
        "You are the knowledge agent for HelpDesk Lite. Use handbook excerpts. Return ONLY JSON matching: {relevant: boolean, summary: string, citations: [{documentTitle, excerpt, score}], suggestedSteps: string[]}",
    },
    {
      role: "user",
      content: `Ticket: ${input.title}\n${input.description}\n\nKnowledge excerpts:\n${docs || "None"}\n\nSummarize relevant guidance.`,
    },
  ]);

  return parseModelJson(content, KnowledgeOutputSchema);
}
