export type GoldenCase = {
  id: string;
  title: string;
  description: string;
  expectedCategory: "IT" | "HR" | "FACILITIES" | "OTHER";
};

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "g1",
    title: "WiFi keeps dropping",
    description: "Laptop disconnects from office WiFi every few minutes.",
    expectedCategory: "IT",
  },
  {
    id: "g2",
    title: "Need VPN for contractor",
    description: "Please provision VPN credentials before Monday.",
    expectedCategory: "IT",
  },
  {
    id: "g3",
    title: "Printer jam on floor 3",
    description: "Finance printer shows paper jam even when tray is empty.",
    expectedCategory: "IT",
  },
  {
    id: "g4",
    title: "Missing March payslip",
    description: "Payslip for March is not visible in the portal.",
    expectedCategory: "HR",
  },
  {
    id: "g5",
    title: "Leave balance looks wrong",
    description: "Portal shows 3 PTO days but I should have 8.",
    expectedCategory: "HR",
  },
  {
    id: "g6",
    title: "Onboarding for new hire",
    description: "New engineer starts July 15 — need laptop and badge.",
    expectedCategory: "HR",
  },
  {
    id: "g7",
    title: "Standing desk request",
    description: "Need a height-adjustable desk for ergonomic reasons.",
    expectedCategory: "FACILITIES",
  },
  {
    id: "g8",
    title: "Broken chair near kitchen",
    description: "Chair has a loose wheel and nearly tipped over.",
    expectedCategory: "FACILITIES",
  },
  {
    id: "g9",
    title: "Water leak at reception",
    description: "Ceiling leak above the front desk — urgent facilities check.",
    expectedCategory: "FACILITIES",
  },
  {
    id: "g10",
    title: "Expense report stuck",
    description: "Travel expenses still pending with no approver listed.",
    expectedCategory: "OTHER",
  },
  {
    id: "g11",
    title: "Software installation blocked",
    description: "The laptop software installer requires administrator access.",
    expectedCategory: "IT",
  },
  {
    id: "g12",
    title: "Parking pass replacement",
    description: "My office parking badge was damaged and needs replacement.",
    expectedCategory: "FACILITIES",
  },
];
