import { parseModelJson } from "@/lib/ai/parse";
import type { LlmProvider, RetrievalHit, TriageOutput } from "@/lib/ai/types";
import { TriageOutputSchema } from "@/lib/ai/types";

export async function runTriageAgent(input: {
  provider: LlmProvider;
  title: string;
  description: string;
  similarTickets: RetrievalHit[];
}): Promise<TriageOutput> {
  const similar = input.similarTickets
    .map((t, i) => `${i + 1}. ${t.title} (score=${t.score.toFixed(2)}): ${t.excerpt}`)
    .join("\n");

  const content = await input.provider.complete([
    {
      role: "system",
      content:
        "You are the triage agent for HelpDesk Lite. Classify the ticket. Return ONLY JSON matching: {category: IT|HR|FACILITIES|OTHER, priority: LOW|MEDIUM|HIGH|URGENT, confidence: number, rationale: string, tags: string[]}",
    },
    {
      role: "user",
      content: `Ticket title: ${input.title}\nDescription: ${input.description}\n\nSimilar historical tickets:\n${similar || "None"}\n\nClassify this ticket.`,
    },
  ]);

  return parseModelJson(content, TriageOutputSchema);
}
