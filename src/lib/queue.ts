import type { Job } from "bullmq";

let Queue: any, Worker: any, QueueEvents: any;

async function loadBull() {
  try {
    const bull = await import("bullmq");
    Queue = bull.Queue;
    Worker = bull.Worker;
    QueueEvents = bull.QueueEvents;
    return true;
  } catch {
    return false;
  }
}

function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL || "";
  if (!url || url === "redis://localhost:6379" && process.env.NODE_ENV !== "production") return null;
  return url;
}

interface JobPayloads {
  campaign: { campaignId: string; userId: string };
  warmup: { type: "sends" | "reconcile" | "imap" };
}

type JobType = keyof JobPayloads;

let bullLoaded = false;
let bullReady = false;

async function ensureBull() {
  if (bullLoaded) return bullReady;
  bullLoaded = true;

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    bullReady = false;
    return false;
  }

  bullReady = await loadBull();
  return bullReady;
}

export async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayloads[T],
  options?: { delay?: number }
) {
  const useBull = await ensureBull();

  if (useBull && Queue) {
    const queue = new Queue(type, { connection: { url: getRedisUrl() } });
    await queue.add(type, payload, { ...options, removeOnComplete: 100, removeOnFail: 200 });
    await queue.close();
    return;
  }

  await executeJobDirectly(type, payload);
}

async function executeJobDirectly(type: string, payload: any) {
  console.log(`[queue] Running ${type} job inline (no Redis available)`);

  if (type === "campaign") {
    const { executeCampaign } = await import("@/engine/campaign");
    await executeCampaign(payload.campaignId);
  } else if (type === "warmup") {
    const warmup = await import("@/engine/warmup");
    switch (payload.type) {
      case "sends":
        await warmup.processDueWarmupSends();
        break;
      case "reconcile":
        await warmup.reconcileWarmupSchedules();
        break;
      case "imap":
        await warmup.processSeedInboxes();
        break;
    }
  }
}

export async function startWorker(type: JobType) {
  const useBull = await ensureBull();
  if (!useBull || !Worker) return null;

  const worker = new Worker(
    type,
    async (job: Job) => {
      await executeJobDirectly(job.name, job.data);
    },
    { connection: { url: getRedisUrl() }, concurrency: 5 }
  );

  worker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(`[queue] Worker ${type} job ${job?.id} failed:`, err.message);
  });

  return worker;
}
