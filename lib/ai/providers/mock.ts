import type { LlmMessage, LlmProvider } from "@/lib/ai/types";

/**
 * Deterministic offline provider for tests and demos when Ollama is unavailable.
 * Returns structured JSON based on keywords in the last user message.
 */
export function createMockProvider(): LlmProvider {
  return {
    name: "mock",
    async complete(messages: LlmMessage[]) {
      const system = messages.find((m) => m.role === "system")?.content.toLowerCase() ?? "";
      const user = [...messages].reverse().find((m) => m.role === "user")?.content.toLowerCase() ?? "";
      const text = user;

      if (system.includes("triage") || text.includes("classify this ticket")) {
        let category = "OTHER";
        let priority = "MEDIUM";

        const isFacilities =
          /\b(desk|chair|parking|hvac|facilities|leak|ceiling|bucket)\b/.test(text) ||
          text.includes("standing desk") ||
          text.includes("water leak");
        const isHr =
          /\b(payslip|payroll|leave|pto|onboarding|badge|new hire|hr)\b/.test(text);
        const isIt =
          /\b(wifi|wi-fi|laptop|vpn|printer|software|monitor|network|adapter)\b/.test(text);

        // Prefer domain-specific cues over generic hardware words in onboarding
        if (isFacilities) {
          category = "FACILITIES";
          priority = /\b(leak|urgent)\b/.test(text) ? "URGENT" : "LOW";
        } else if (isHr) {
          category = "HR";
          priority = "MEDIUM";
        } else if (isIt) {
          category = "IT";
          priority = /\b(vpn)\b/.test(text) ? "HIGH" : "MEDIUM";
        }

        return JSON.stringify({
          category,
          priority,
          confidence: 0.86,
          rationale: `Mock triage classified as ${category} based on keyword cues.`,
          tags: [category.toLowerCase(), "mock"],
        });
      }

      if (system.includes("knowledge") || text.includes("knowledge base")) {
        return JSON.stringify({
          relevant: true,
          summary: "Mock knowledge agent found matching handbook guidance.",
          citations: [
            {
              documentTitle: "Internal Support Handbook",
              excerpt: "For network issues, verify WiFi, restart adapter, then escalate to IT.",
              score: 0.78,
            },
          ],
          suggestedSteps: [
            "Confirm the issue still occurs after a basic restart",
            "Ask for device/OS details",
            "Apply the handbook checklist before escalating",
          ],
        });
      }

      if (system.includes("evaluator") || text.includes("evaluate")) {
        return JSON.stringify({
          approved: true,
          issues: [],
          confidence: 0.9,
          notes: "Mock evaluator accepted the draft as safe and actionable.",
        });
      }

      // Resolution default
      return JSON.stringify({
        draftResponse:
          "Thanks for reporting this. We've reviewed similar cases and our internal handbook. Please try the suggested steps; a staff member will follow up if the issue persists.",
        recommendedActions: [
          "Share the drafted response with the requester",
          "Confirm category before assignment",
        ],
        needsHumanReview: true,
        confidence: 0.82,
      });
    },
  };
}
