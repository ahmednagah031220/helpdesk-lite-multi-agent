// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentPanel } from "@/components/AgentPanel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const successfulRun = {
  id: "run-1",
  status: "SUCCEEDED",
  provider: "mock",
  model: "qwen2.5:7b",
  durationMs: 42,
  error: null,
  steps: [
    {
      id: "step-1",
      name: "triage",
      status: "SUCCEEDED",
      durationMs: 5,
      output: "{}",
      evidence: "[]",
    },
  ],
  recommendation: {
    id: "rec-1",
    suggestedCategory: "IT",
    suggestedPriority: "HIGH",
    draftResponse: "Please restart the network adapter.",
    recommendedActions: JSON.stringify(["Review response"]),
    confidence: 0.85,
    needsHumanReview: true,
    citations: JSON.stringify([{ documentTitle: "Support Handbook" }]),
    decision: "PENDING",
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

describe("AgentPanel", () => {
  it("runs agents and renders evidence, draft, and approval controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successfulRun,
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AgentPanel ticketId="ticket-1" initialRun={null} />);

    await user.click(screen.getByRole("button", { name: "Run agents" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/run",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ticketId: "ticket-1", async: true }),
      }),
    );
    expect(await screen.findByText(/Please restart the network adapter/)).toBeTruthy();
    expect(screen.getByText(/Support Handbook/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("submits a human decision and hides repeat-decision controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decision: "APPROVED" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AgentPanel ticketId="ticket-1" initialRun={successfulRun} />);

    await user.type(screen.getByPlaceholderText("Optional note"), "Verified");
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/recommendations/rec-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          decision: "APPROVED",
          note: "Verified",
          applyCategory: true,
        }),
      }),
    );
    expect((await screen.findByText(/Decision:/)).textContent).toContain(
      "APPROVED",
    );
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("shows API failures without replacing the prior run", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Model unavailable" }),
      }),
    );
    const user = userEvent.setup();
    render(<AgentPanel ticketId="ticket-1" initialRun={null} />);

    await user.click(screen.getByRole("button", { name: "Run agents" }));

    expect(await screen.findByText("Model unavailable")).toBeTruthy();
  });
});
