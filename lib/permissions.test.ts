import { describe, expect, it } from "vitest";
import {
  canDecideRecommendation,
  canManageKnowledge,
  canRunAgents,
  canViewAgentRuns,
  canViewManagerSummary,
  canViewTicket,
  getAgentRunListFilter,
} from "@/lib/permissions";
import { Role } from "@/lib/enums";

const employee = {
  id: "e1",
  email: "e@x.com",
  name: "E",
  role: Role.EMPLOYEE,
  orgId: "org-1",
};
const staff = {
  id: "s1",
  email: "s@x.com",
  name: "S",
  role: Role.STAFF,
  orgId: "org-1",
};
const otherStaff = {
  id: "s2",
  email: "s2@x.com",
  name: "S2",
  role: Role.STAFF,
  orgId: "org-1",
};
const manager = {
  id: "m1",
  email: "m@x.com",
  name: "M",
  role: Role.MANAGER,
  orgId: "org-1",
};
const otherOrgStaff = {
  id: "s3",
  email: "s3@x.com",
  name: "S3",
  role: Role.STAFF,
  orgId: "org-2",
};

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

  it("scopes staff runs while managers can see all runs in their org", () => {
    expect(getAgentRunListFilter(staff)).toEqual({
      ticket: {
        is: {
          orgId: "org-1",
          OR: [{ assigneeId: "s1" }, { assigneeId: null }],
        },
      },
    });
    expect(getAgentRunListFilter(manager)).toEqual({
      ticket: { is: { orgId: "org-1" } },
    });
  });

  it("lets employees keep viewing tickets they submitted after staff claims them", () => {
    expect(
      canViewTicket(employee, {
        submitterId: "e1",
        assigneeId: "s1",
        orgId: "org-1",
      }),
    ).toBe(true);
    expect(
      canViewTicket(employee, {
        submitterId: "other",
        assigneeId: "s1",
        orgId: "org-1",
      }),
    ).toBe(false);
  });

  it("blocks cross-organization access", () => {
    expect(
      canViewTicket(otherOrgStaff, {
        submitterId: "e1",
        assigneeId: null,
        orgId: "org-1",
      }),
    ).toBe(false);
  });

  it("lets staff view only unassigned or self-assigned tickets", () => {
    expect(
      canViewTicket(staff, { submitterId: "e1", assigneeId: null, orgId: "org-1" }),
    ).toBe(true);
    expect(
      canViewTicket(staff, { submitterId: "e1", assigneeId: "s1", orgId: "org-1" }),
    ).toBe(true);
    expect(
      canViewTicket(staff, {
        submitterId: "e1",
        assigneeId: otherStaff.id,
        orgId: "org-1",
      }),
    ).toBe(false);
    expect(
      canViewTicket(manager, {
        submitterId: "e1",
        assigneeId: otherStaff.id,
        orgId: "org-1",
      }),
    ).toBe(true);
  });
});
