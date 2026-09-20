import { Redis } from "ioredis";
import { config } from "./config.js";

export class JobState {
  private readonly redis?: Redis;

  constructor() {
    if (process.env.REDIS_URL) this.redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async start(runId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.connect().catch(() => undefined);
    await this.redis.set(`triviality:ingest:${runId}`, JSON.stringify({ status: "running", startedAt: new Date().toISOString() }), "EX", 60 * 60 * 24);
  }

  async complete(runId: string, result: Record<string, unknown>): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(`triviality:ingest:${runId}`, JSON.stringify({ status: "completed", ...result, completedAt: new Date().toISOString() }), "EX", 60 * 60 * 24);
    await this.redis.quit().catch(() => undefined);
  }

  async fail(runId: string, error: unknown): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(`triviality:ingest:${runId}`, JSON.stringify({ status: "failed", error: String(error), completedAt: new Date().toISOString() }), "EX", 60 * 60 * 24);
    await this.redis.quit().catch(() => undefined);
  }
}
