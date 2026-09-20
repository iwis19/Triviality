import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), "../../.env") });

export const config = {
  port: Number(process.env.PAPER_API_PORT ?? 3001),
  maxPdfBytes: Number(process.env.PAPER_MAX_PDF_BYTES ?? 25 * 1024 * 1024),
  openAiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  artifactRoot: process.env.ARTIFACT_ROOT ?? ".data/object-storage",
};

if (!config.openAiKey) console.warn("OPENAI_API_KEY is not configured; /paper-embbed will reject parsing requests.");
