import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), "../../.env") });

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  mongodbUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017",
  mongodbDatabase: process.env.MONGODB_DATABASE ?? "triviality",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  openAlexEmail: process.env.OPENALEX_EMAIL,
  openAlexFilter: process.env.OPENALEX_WORKS_FILTER ?? "type:article,primary_topic.field.id:26",
  openAlexPerPage: Math.min(numberEnv("OPENALEX_PER_PAGE", 100), 100),
  openAlexAreaLimit: numberEnv("OPENALEX_AREA_LIMIT", 0),
  openAlexRequestDelayMs: numberEnv("OPENALEX_REQUEST_DELAY_MS", 250),
  embeddingApiUrl: process.env.EMBEDDING_API_URL ?? "https://api.openai.com/v1/embeddings",
  embeddingApiKey: process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY,
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  artifactRoot: process.env.ARTIFACT_ROOT ?? ".data/object-storage",
  intervalMinutes: numberEnv("INGEST_INTERVAL_MINUTES", 1440),
  runOnStart: process.env.RUN_ON_START !== "false",
};
