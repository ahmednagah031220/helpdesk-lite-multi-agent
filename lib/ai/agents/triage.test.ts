import { describe, expect, it } from "vitest";
import { runTriageAgent } from "@/lib/ai/agents/triage";
import { createMockProvider } from "@/lib/ai/providers/mock";

describe("runTriageAgent", () => {
  it("classifies WiFi tickets as IT via mock provider", async () => {
    const result = await runTriageAgent({
      provider: createMockProvider(),
      title: "WiFi keeps dropping",
      description: "Laptop disconnects from office WiFi",
      similarTickets: [],
    });
    expect(result.category).toBe("IT");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("classifies payslip tickets as HR", async () => {
    const result = await runTriageAgent({
      provider: createMockProvider(),
      title: "Missing March payslip",
      description: "Payslip not visible in the portal",
      similarTickets: [],
    });
    expect(result.category).toBe("HR");
  });
});
