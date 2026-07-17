import { describe, expect, it } from "vitest";
import {
  canDecideRecommendation,
  canManageKnowledge,
  canRunAgents,
  canViewAgentRuns,
  canViewManagerSummary,
  getAgentRunListFilter,
} from "@/lib/permissions";
import { Role } from "@/lib/enums";

const employee = {
  id: "e1",
  email: "e@x.com",
  name: "E",
  role: Role.EMPLOYEE,
};
const staff = { id: "s1", email: "s@x.com", name: "S", role: Role.STAFF };
const manager = { id: "m1", email: "m@x.com", name: "M", role: Role.MANAGER };

describe("agent permissions", () => {
  it("allows staff and manager to run agents", () => {
    expect(canRunAgents(staff)).toBe(true);
    expect(canRunAgents(manager)).toBe(true);
    expect(canRunAgents(employee)).toBe(false);
  });

  it("restricts recommendation decisions to staff", () => {
    expect(canDecideRecommendation(staff)).toBe(true);
    expect(canDecideRecommendation(manager)).toBe(false);
    expect(canDecideRecommendation(employee)).toBe(false);
  });

  it("gates knowledge and agent-run views", () => {
    expect(canManageKnowledge(staff)).toBe(true);
    expect(canManageKnowledge(employee)).toBe(false);
    expect(canViewAgentRuns(manager)).toBe(true);
    expect(canViewAgentRuns(employee)).toBe(false);
    expect(canViewManagerSummary(manager)).toBe(true);
  });

  it("scopes staff runs while managers can see all runs", () => {
    expect(getAgentRunListFilter(staff)).toEqual({
      ticket: {
        is: {
          OR: [{ assigneeId: "s1" }, { assigneeId: null }],
        },
      },
    });
    expect(getAgentRunListFilter(manager)).toEqual({});
  });
});
