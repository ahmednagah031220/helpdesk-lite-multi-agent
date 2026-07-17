import { Role } from "@/lib/enums";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
};

export function canCreateTicket(): boolean {
  return true;
}

export function canViewTicket(
  user: SessionUser,
  ticket: { submitterId: string; assigneeId: string | null; orgId?: string },
): boolean {
  if (ticket.orgId && ticket.orgId !== user.orgId) return false;
  if (user.role === Role.MANAGER) return true;
  if (user.role === Role.STAFF) {
    return ticket.assigneeId === user.id || ticket.assigneeId === null;
  }
  return ticket.submitterId === user.id;
}

export function canAssignTicket(user: SessionUser): boolean {
  return user.role === Role.STAFF;
}

export function canUpdateTicketStatus(user: SessionUser): boolean {
  return user.role === Role.STAFF;
}

export function canViewManagerSummary(user: SessionUser): boolean {
  return user.role === Role.MANAGER;
}

export function canRunAgents(user: SessionUser): boolean {
  return user.role === Role.STAFF || user.role === Role.MANAGER;
}

export function canManageKnowledge(user: SessionUser): boolean {
  return user.role === Role.STAFF || user.role === Role.MANAGER;
}

export function canDecideRecommendation(user: SessionUser): boolean {
  return user.role === Role.STAFF;
}

export function canViewAgentRuns(user: SessionUser): boolean {
  return user.role === Role.STAFF || user.role === Role.MANAGER;
}

export function getTicketListFilter(user: SessionUser) {
  const orgScope = { orgId: user.orgId };
  switch (user.role) {
    case Role.MANAGER:
      return orgScope;
    case Role.STAFF:
      return {
        ...orgScope,
        OR: [{ assigneeId: user.id }, { assigneeId: null }],
      };
    case Role.EMPLOYEE:
    default:
      return { ...orgScope, submitterId: user.id };
  }
}

export function getAgentRunListFilter(user: SessionUser) {
  const ticketFilter = getTicketListFilter(user);
  return { ticket: { is: ticketFilter } };
}
