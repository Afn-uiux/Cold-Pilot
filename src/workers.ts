import { startWorker } from "./lib/queue";

async function main() {
  console.log("[workers] Starting background workers...");

  const warmupWorker = await startWorker("warmup");
  const campaignWorker = await startWorker("campaign");
  const replyCheckWorker = await startWorker("replyCheck");

  if (!warmupWorker && !campaignWorker && !replyCheckWorker) {
    console.log("[workers] Redis not available — workers not started");
    process.exit(0);
  }

  console.log("[workers] Workers running");
}

main().catch((err) => {
  console.error("[workers] Failed to start:", err);
  process.exit(1);
});
