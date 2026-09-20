import "./environment.js";
import { resolve } from "node:path";

export const config = {
  mongodbUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017",
  mongodbDatabase: process.env.MONGODB_DATABASE ?? "triviality",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  openAiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  devinApiKey: process.env.DEVIN_API_KEY || process.env.MATHLAB_DEVIN_API_KEY,
  devinOrgId: process.env.DEVIN_ORG_ID || process.env.MATHLAB_DEVIN_ORG_ID,
  devinBaseUrl: process.env.DEVIN_BASE_URL ?? process.env.MATHLAB_DEVIN_API_BASE ?? "https://api.devin.ai",
  devinMaxAcu: Number(process.env.DEVIN_MAX_ACU ?? process.env.MATHLAB_DEVIN_MAX_ACU_LIMIT ?? 2),
  trivialityUrl: process.env.TRIVIALITY_URL ?? "http://localhost:3000",
  leanProjectDir: process.env.LEAN_PROJECT_DIR ?? resolve(process.cwd(), "../../external/norththehackers/lean"),
  leanTimeoutMs: Number(process.env.LEAN_TIMEOUT_MS ?? 120000),
};
