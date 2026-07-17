import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notificationCreate: vi.fn(),
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    notificationLog: { create: mocks.notificationCreate },
  },
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));

import {
  isEmailConfigured,
  isWebhookConfigured,
  notify,
} from "@/lib/notifications";

describe("notifications", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificationCreate.mockResolvedValue({});
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.sendMail.mockResolvedValue({ messageId: "msg-1" });
    vi.stubGlobal("fetch", mocks.fetch);
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    delete process.env.NOTIFY_EMAIL_TO;
    delete process.env.WEBHOOK_URL;
    delete process.env.WEBHOOK_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("always persists an audit log entry", async () => {
    const result = await notify("assigned", {
      id: "t1",
      title: "VPN access",
    });

    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: "assigned",
        ticketId: "t1",
      }),
    });
    expect(result.payload.event).toBe("assigned");
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("sends email when SMTP is configured", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_FROM = "HelpDesk <noreply@example.com>";
    process.env.NOTIFY_EMAIL_TO = "staff@example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    expect(isEmailConfigured()).toBe(true);

    const result = await notify(
      "ai_run_completed",
      { id: "t1", title: "WiFi issue" },
      { runId: "run-1", recipients: ["alice@example.com"] },
    );

    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "user", pass: "pass" },
      }),
    );
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        subject: expect.stringContaining("AI agent run completed"),
      }),
    );
    expect(result.delivery.email?.sent).toBe(true);
  });

  it("posts to webhook when WEBHOOK_URL is set", async () => {
    process.env.WEBHOOK_URL = "https://hooks.example.com/helpdesk";
    process.env.WEBHOOK_SECRET = "secret-token";
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => "",
    });

    expect(isWebhookConfigured()).toBe(true);

    const result = await notify(
      "resolved",
      { id: "t2", title: "Printer jam" },
      { status: "RESOLVED" },
    );

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://hooks.example.com/helpdesk",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
          "X-Webhook-Secret": "secret-token",
        }),
      }),
    );
    expect(result.delivery.webhook?.sent).toBe(true);
  });

  it("does not fail the caller when a sink errors", async () => {
    process.env.WEBHOOK_URL = "https://hooks.example.com/helpdesk";
    mocks.fetch.mockRejectedValue(new Error("network down"));

    const result = await notify("assigned", {
      id: "t3",
      title: "Badge request",
    });

    expect(mocks.notificationCreate).toHaveBeenCalledOnce();
    expect(result.delivery.webhook?.sent).toBe(false);
    expect(result.delivery.webhook?.reason).toContain("network down");
  });
});
