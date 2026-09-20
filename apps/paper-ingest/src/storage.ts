import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

export async function storeRawMetadata(externalId: string, payload: unknown): Promise<{ bucket: string; key: string; checksum: string; bytes: number }> {
  const body = JSON.stringify(payload, null, 2);
  const checksum = createHash("sha256").update(body).digest("hex");
  const key = `papers/${createHash("sha256").update(externalId).digest("hex")}.json`;
  const path = join(config.artifactRoot, key);
  await mkdir(join(config.artifactRoot, "papers"), { recursive: true });
  await writeFile(path, body, "utf8");
  return { bucket: "local-object-storage", key, checksum, bytes: Buffer.byteLength(body) };
}
