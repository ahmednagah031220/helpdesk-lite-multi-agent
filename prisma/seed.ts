import "dotenv/config";
import {
  Category,
  PrismaClient,
  Role,
  TicketStatus,
} from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "password123";

type MockUser = { name: string; email: string; role: Role };

type StatusStep = {
  from: TicketStatus | null;
  to: TicketStatus;
  hoursAfterCreate: number;
  changedBy: "submitter" | "assignee" | "staff";
};

type MockTicket = {
  title: string;
  description: string;
  category: Category;
  submitterEmail: string;
  assigneeEmail?: string;
  status: TicketStatus;
  daysAgo: number;
  history: StatusStep[];
};

const USERS: MockUser[] = [
  { name: "Alice Employee", email: "employee@helpdesk.local", role: Role.EMPLOYEE },
  { name: "Dan Rivera", email: "dan@helpdesk.local", role: Role.EMPLOYEE },
  { name: "Eva Chen", email: "eva@helpdesk.local", role: Role.EMPLOYEE },
  { name: "Frank Okonkwo", email: "frank@helpdesk.local", role: Role.EMPLOYEE },
  { name: "Grace Park", email: "grace@helpdesk.local", role: Role.EMPLOYEE },
  { name: "Bob Staff", email: "staff@helpdesk.local", role: Role.STAFF },
  { name: "Helen Support", email: "helen@helpdesk.local", role: Role.STAFF },
  { name: "Ian Support", email: "ian@helpdesk.local", role: Role.STAFF },
  { name: "Carol Manager", email: "manager@helpdesk.local", role: Role.MANAGER },
];

const TICKETS: MockTicket[] = [
  {
    title: "Laptop not connecting to WiFi",
    description:
      "My laptop drops the office WiFi every few minutes. I've restarted twice and forgotten/re-added the network.",
    category: Category.IT,
    submitterEmail: "employee@helpdesk.local",
    status: TicketStatus.OPEN,
    daysAgo: 0,
    history: [{ from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" }],
  },
  {
    title: "VPN access for new contractor",
    description:
      "Contractor starts Monday. Need VPN credentials and access to the shared drive for Project Atlas.",
    category: Category.IT,
    submitterEmail: "dan@helpdesk.local",
    status: TicketStatus.OPEN,
    daysAgo: 1,
    history: [{ from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" }],
  },
  {
    title: "Printer on 3rd floor jamming",
    description:
      "The main printer near Finance keeps showing a paper jam error even when the tray is clear.",
    category: Category.IT,
    submitterEmail: "eva@helpdesk.local",
    status: TicketStatus.OPEN,
    daysAgo: 2,
    history: [{ from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" }],
  },
  {
    title: "Update mailing address",
    description: "Moved last month — need payroll and benefits records updated to the new address.",
    category: Category.HR,
    submitterEmail: "frank@helpdesk.local",
    status: TicketStatus.OPEN,
    daysAgo: 3,
    history: [{ from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" }],
  },
  {
    title: "Conference room AC not cooling",
    description:
      "Room 3B has been uncomfortably warm during afternoon meetings. Thermostat shows 26°C.",
    category: Category.FACILITIES,
    submitterEmail: "grace@helpdesk.local",
    assigneeEmail: "staff@helpdesk.local",
    status: TicketStatus.IN_PROGRESS,
    daysAgo: 4,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 5, changedBy: "assignee" },
    ],
  },
  {
    title: "Second monitor flickering",
    description:
      "External display flickers when docking/undocking. Tried a different HDMI cable — same issue.",
    category: Category.IT,
    submitterEmail: "employee@helpdesk.local",
    assigneeEmail: "helen@helpdesk.local",
    status: TicketStatus.IN_PROGRESS,
    daysAgo: 2,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 3, changedBy: "assignee" },
    ],
  },
  {
    title: "Payslip missing for March",
    description: "March payslip isn't showing in the employee portal. April and May are visible.",
    category: Category.HR,
    submitterEmail: "dan@helpdesk.local",
    assigneeEmail: "ian@helpdesk.local",
    status: TicketStatus.IN_PROGRESS,
    daysAgo: 5,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 8, changedBy: "assignee" },
    ],
  },
  {
    title: "Request standing desk",
    description:
      "Doctor's note attached in email. Requesting a height-adjustable desk for ergonomic reasons.",
    category: Category.FACILITIES,
    submitterEmail: "eva@helpdesk.local",
    assigneeEmail: "staff@helpdesk.local",
    status: TicketStatus.RESOLVED,
    daysAgo: 7,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 6, changedBy: "assignee" },
      { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED, hoursAfterCreate: 48, changedBy: "assignee" },
    ],
  },
  {
    title: "Slack not syncing on mobile",
    description: "Mobile app shows messages from 2 days ago. Desktop works fine. Reinstalled — no change.",
    category: Category.IT,
    submitterEmail: "frank@helpdesk.local",
    assigneeEmail: "helen@helpdesk.local",
    status: TicketStatus.RESOLVED,
    daysAgo: 6,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 2, changedBy: "assignee" },
      { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED, hoursAfterCreate: 24, changedBy: "assignee" },
    ],
  },
  {
    title: "Leave balance incorrect",
    description: "Portal shows 3 days PTO remaining but I should have 8 after the policy change.",
    category: Category.HR,
    submitterEmail: "grace@helpdesk.local",
    assigneeEmail: "ian@helpdesk.local",
    status: TicketStatus.RESOLVED,
    daysAgo: 10,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 4, changedBy: "assignee" },
      { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED, hoursAfterCreate: 36, changedBy: "assignee" },
    ],
  },
  {
    title: "Broken chair in open workspace",
    description: "Chair near the kitchen has a loose wheel — nearly tipped over during a call.",
    category: Category.FACILITIES,
    submitterEmail: "employee@helpdesk.local",
    assigneeEmail: "staff@helpdesk.local",
    status: TicketStatus.CLOSED,
    daysAgo: 14,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 3, changedBy: "assignee" },
      { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED, hoursAfterCreate: 20, changedBy: "assignee" },
      { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED, hoursAfterCreate: 72, changedBy: "assignee" },
    ],
  },
  {
    title: "New software license for Figma",
    description: "Design team needs one additional Figma editor seat for the summer intern.",
    category: Category.IT,
    submitterEmail: "dan@helpdesk.local",
    assigneeEmail: "helen@helpdesk.local",
    status: TicketStatus.CLOSED,
    daysAgo: 12,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 1, changedBy: "assignee" },
      { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED, hoursAfterCreate: 16, changedBy: "assignee" },
      { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED, hoursAfterCreate: 48, changedBy: "assignee" },
    ],
  },
  {
    title: "Onboarding checklist for new hire",
    description: "New engineer starts July 15 — need laptop, badge, and account setup coordinated.",
    category: Category.HR,
    submitterEmail: "eva@helpdesk.local",
    assigneeEmail: "ian@helpdesk.local",
    status: TicketStatus.CLOSED,
    daysAgo: 20,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 2, changedBy: "assignee" },
      { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED, hoursAfterCreate: 96, changedBy: "assignee" },
      { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED, hoursAfterCreate: 120, changedBy: "assignee" },
    ],
  },
  {
    title: "Parking pass renewal",
    description: "Annual parking pass expires end of month. Same spot preferred if available.",
    category: Category.OTHER,
    submitterEmail: "frank@helpdesk.local",
    assigneeEmail: "staff@helpdesk.local",
    status: TicketStatus.CLOSED,
    daysAgo: 18,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 12, changedBy: "assignee" },
      { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED, hoursAfterCreate: 60, changedBy: "assignee" },
      { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED, hoursAfterCreate: 96, changedBy: "assignee" },
    ],
  },
  {
    title: "Water leak near reception",
    description: "Small leak from ceiling tile above the front desk. Bucket placed — needs urgent check.",
    category: Category.FACILITIES,
    submitterEmail: "grace@helpdesk.local",
    assigneeEmail: "ian@helpdesk.local",
    status: TicketStatus.IN_PROGRESS,
    daysAgo: 1,
    history: [
      { from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" },
      { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS, hoursAfterCreate: 1, changedBy: "assignee" },
    ],
  },
  {
    title: "Expense report stuck in approval",
    description: "Submitted travel expenses 2 weeks ago — still showing 'pending' with no approver listed.",
    category: Category.OTHER,
    submitterEmail: "employee@helpdesk.local",
    status: TicketStatus.OPEN,
    daysAgo: 1,
    history: [{ from: null, to: TicketStatus.OPEN, hoursAfterCreate: 0, changedBy: "submitter" }],
  },
];

/** Ticket/event time: created `daysAgo` days ago, then shifted forward by `hoursAfterCreate`. */
function hoursAgo(daysAgo: number, hoursAfterCreate: number): Date {
  const createdMs = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  return new Date(createdMs + hoursAfterCreate * 60 * 60 * 1000);
}

async function main() {
  const hashed = hashSync(PASSWORD, 10);

  const org = await prisma.organization.upsert({
    where: { slug: "acme" },
    update: { name: "Acme Corp" },
    create: {
      id: "org_default_acme",
      name: "Acme Corp",
      slug: "acme",
    },
  });

  for (const user of USERS) {
    await prisma.user.upsert({
      where: { orgId_email: { orgId: org.id, email: user.email } },
      update: { name: user.name, role: user.role, password: hashed },
      create: {
        ...user,
        password: hashed,
        orgId: org.id,
        authProvider: "credentials",
      },
    });
  }

  const userByEmail = Object.fromEntries(
    (await prisma.user.findMany({ where: { orgId: org.id } })).map((user) => [
      user.email,
      user,
    ]),
  );

  await prisma.notificationLog.deleteMany({ where: { orgId: org.id } });
  await prisma.agentReport.deleteMany({
    where: { run: { ticket: { orgId: org.id } } },
  });
  await prisma.aiRecommendation.deleteMany({
    where: { run: { ticket: { orgId: org.id } } },
  });
  await prisma.agentStep.deleteMany({
    where: { run: { ticket: { orgId: org.id } } },
  });
  await prisma.agentRun.deleteMany({
    where: { ticket: { orgId: org.id } },
  });
  await prisma.knowledgeChunk.deleteMany({
    where: { document: { orgId: org.id } },
  });
  await prisma.knowledgeDocument.deleteMany({ where: { orgId: org.id } });
  await prisma.statusEvent.deleteMany({
    where: { ticket: { orgId: org.id } },
  });
  await prisma.ticket.deleteMany({ where: { orgId: org.id } });

  for (const mock of TICKETS) {
    const submitter = userByEmail[mock.submitterEmail];
    const assignee = mock.assigneeEmail
      ? userByEmail[mock.assigneeEmail]
      : undefined;

    if (!submitter) {
      throw new Error(`Unknown submitter: ${mock.submitterEmail}`);
    }

    const createdAt = hoursAgo(mock.daysAgo, 0);
    const lastEvent = mock.history[mock.history.length - 1];
    const updatedAt = hoursAgo(mock.daysAgo, lastEvent.hoursAfterCreate);

    await prisma.ticket.create({
      data: {
        title: mock.title,
        description: mock.description,
        category: mock.category,
        status: mock.status,
        orgId: org.id,
        submitterId: submitter.id,
        assigneeId: assignee?.id ?? null,
        createdAt,
        updatedAt,
        statusEvents: {
          create: mock.history.map((step) => {
            const staffUser = userByEmail["staff@helpdesk.local"];
            let changedByUser;
            if (step.changedBy === "submitter") {
              changedByUser = submitter;
            } else if (step.changedBy === "assignee") {
              changedByUser = assignee ?? staffUser;
            } else {
              changedByUser = staffUser;
            }

            return {
              fromStatus: step.from,
              toStatus: step.to,
              changedBy: changedByUser.id,
              changedAt: hoursAgo(mock.daysAgo, step.hoursAfterCreate),
            };
          }),
        },
      },
    });
  }

  const handbook = `Internal Support Handbook

IT Network Issues
For WiFi and laptop connectivity problems, verify the corporate SSID, forget/re-add the network, restart the wireless adapter, and check VPN status. Escalate to IT if the issue continues after two restarts.

VPN Access
New contractors need VPN credentials and shared drive access. Confirm manager approval, create the account, and send temporary credentials. Mark as HIGH priority when access is needed within 48 hours.

Printers
Clear paper trays, check jam sensors, and reboot the printer. If the jam error persists with an empty tray, create an IT facilities ticket for on-site service.

HR Payslips and Leave
Missing payslips or incorrect leave balances should be routed to HR. Ask for the pay period and employee ID. Do not share payroll details in public channels.

Facilities Requests
Standing desks, broken chairs, parking passes, and HVAC issues belong to Facilities. Water leaks are URGENT — place a bucket and notify Facilities immediately.

Onboarding
Coordinate laptop, badge, and account setup for new hires at least five business days before start date.
`;

  const { persistChunkEmbedding } = await import("../lib/ai/retrieval/pdf");
  const chunks = handbook.match(/[\s\S]{1,700}/g) ?? [handbook];
  const doc = await prisma.knowledgeDocument.create({
    data: {
      title: "Internal Support Handbook",
      filename: "internal-support-handbook.txt",
      content: handbook,
      chunkCount: chunks.length,
      orgId: org.id,
      uploadedBy: userByEmail["staff@helpdesk.local"]?.id,
      chunks: {
        create: chunks.map((content, index) => ({ index, content })),
      },
    },
    include: { chunks: true },
  });

  process.env.EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER ?? "local";
  for (const chunk of doc.chunks) {
    await persistChunkEmbedding(chunk.id, chunk.content);
  }

  const counts = await prisma.ticket.groupBy({
    by: ["status"],
    where: { orgId: org.id },
    _count: { status: true },
  });

  console.log("Seed complete — mock data loaded.");
  console.log(`  Org: ${org.name} (${org.slug})`);
  console.log(`  Users: ${USERS.length}`);
  console.log(`  Tickets: ${TICKETS.length}`);
  console.log(`  Knowledge docs: 1 (${doc.chunks.length} embedded chunks)`);
  console.log(
    "  By status:",
    Object.fromEntries(counts.map((c) => [c.status, c._count.status])),
  );
  console.log("\nAll accounts use password: password123");
  console.log("  Employee: employee@helpdesk.local (+ dan, eva, frank, grace)");
  console.log("  Staff:    staff@helpdesk.local (+ helen, ian)");
  console.log("  Manager:  manager@helpdesk.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
