import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

export const AGENT_QUEUE_NAME = "agent-runs";

export type AgentJobPayload = {
  runId: string;
  ticketId: string;
  triggeredById?: string;
};

let connection: IORedis | null = null;
let queue: Queue<AgentJobPayload> | null = null;

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
}

export function isQueueEnabled(): boolean {
  return process.env.AGENT_QUEUE !== "off";
}

export async function isRedisAvailable(): Promise<boolean> {
  if (!isQueueEnabled()) return false;
  try {
    const client = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      lazyConnect: true,
    });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return pong === "PONG";
  } catch {
    return false;
  }
}

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export function getAgentQueue(): Queue<AgentJobPayload> {
  if (!queue) {
    queue = new Queue<AgentJobPayload>(AGENT_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }
  return queue;
}

export async function enqueueAgentRun(
  payload: AgentJobPayload,
): Promise<{ jobId: string } | null> {
  if (!(await isRedisAvailable())) {
    return null;
  }
  const job = await getAgentQueue().add("run", payload, {
    jobId: payload.runId,
  });
  return { jobId: String(job.id) };
}

export function createAgentWorker(
  processor: (job: Job<AgentJobPayload>) => Promise<void>,
): Worker<AgentJobPayload> {
  return new Worker<AgentJobPayload>(AGENT_QUEUE_NAME, processor, {
    connection: getConnection(),
    concurrency: Number(process.env.AGENT_WORKER_CONCURRENCY ?? 2),
  });
}
