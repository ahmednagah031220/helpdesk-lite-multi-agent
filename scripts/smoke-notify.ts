import "dotenv/config";
import { notify } from "@/lib/notifications";

async function main() {
  const result = await notify(
    "ai_run_completed",
    { id: "smoke-ticket", title: "Smoke: WiFi disconnect demo" },
    {
      runId: "smoke-run",
      recommendationId: "smoke-rec",
      category: "IT",
      priority: "MEDIUM",
      confidence: 0.9,
      note: "Local smoke notification for Mailpit + webhook echo",
    },
  );

  console.log("Notification delivered:");
  console.log(JSON.stringify(result.delivery, null, 2));
  console.log("Check Mailpit UI: http://127.0.0.1:8025");
  console.log("Check webhook echo: http://127.0.0.1:8089/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
