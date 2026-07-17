import { TicketStatus } from "@/lib/enums";

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  IN_PROGRESS: [TicketStatus.RESOLVED, TicketStatus.OPEN],
  RESOLVED: [TicketStatus.CLOSED],
  CLOSED: [],
};

export function canTransition(
  from: TicketStatus,
  to: TicketStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function getValidNextStatuses(status: TicketStatus): TicketStatus[] {
  return TRANSITIONS[status];
}
