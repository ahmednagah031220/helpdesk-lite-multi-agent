import { Role } from "@/lib/enums";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export function canCreateTicket(): boolean {
  return true;
}

export function canViewTicket(
  user: SessionUser,
  ticket: { submitterId: string; assigneeId: string | null },
): boolean {
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
  switch (user.role) {
    case Role.MANAGER:
      return {};
    case Role.STAFF:
      return {
        OR: [{ assigneeId: user.id }, { assigneeId: null }],
      };
    case Role.EMPLOYEE:
    default:
      return { submitterId: user.id };
  }
}

export function getAgentRunListFilter(user: SessionUser) {
  const ticketFilter = getTicketListFilter(user);
  return Object.keys(ticketFilter).length === 0
    ? {}
    : { ticket: { is: ticketFilter } };
}
