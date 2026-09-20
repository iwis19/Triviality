import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), "../../.env") });

export const config = {
  port: Number(process.env.RESEARCH_API_PORT ?? 3010),
  mongodbUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017",
  mongodbDatabase: process.env.MONGODB_DATABASE ?? "triviality",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
};
