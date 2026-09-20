import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { getCollections, type PaperKnowledgeNodeDocument } from "@triviality/database";
import { config } from "./config.js";
import { createNodeEmbeddings, extractPdfNodes } from "./parser.js";

const app = Fastify({ logger: true });
await app.register(multipart, { limits: { fileSize: config.maxPdfBytes, files: 1 } });

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

async function processPaper(buffer: Buffer, filename: string, contentType?: string) {
  if (!config.openAiKey) throw new Error("OPENAI_API_KEY is not configured on the server");
  if (contentType && contentType !== "application/pdf") throw new Error("The uploaded file must be a PDF");

  const paperId = id("paper");
  const paperKey = `papers/${paperId}.pdf`;
  const paperPath = join(config.artifactRoot, paperKey);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  await mkdir(join(config.artifactRoot, "papers"), { recursive: true });
  await writeFile(paperPath, buffer);

  const parsed = await extractPdfNodes(buffer);
  const vectors = await createNodeEmbeddings(parsed.nodes);
  const collections = await getCollections();
  const now = new Date();

  await collections.papers.insertOne({ _id: paperId, externalId: paperId, title: filename.replace(/\.pdf$/i, ""), subjects: ["mathematics"], citedByCount: 0, rawMetadata: { filename, pages: parsed.pages, parser: "pdf-parse" }, createdAt: now, updatedAt: now });
  const sourceId = id("source");
  await collections.sources.insertOne({ _id: sourceId, provider: "USER_UPLOAD", externalId: paperId, canonicalUrl: `local://${paperKey}`, metadata: { filename }, createdAt: now, updatedAt: now });
  await collections.paperSources.insertOne({ _id: id("papersource"), paperId, sourceId, retrievedAt: now, createdAt: now, updatedAt: now });
  await collections.objectArtifacts.insertOne({ _id: id("artifact"), bucket: "local-object-storage", storageKey: paperKey, kind: "PDF", mimeType: "application/pdf", byteSize: buffer.byteLength, checksum, paperId, createdAt: now, updatedAt: now });

  const nodes: PaperKnowledgeNodeDocument[] = parsed.nodes.map((node, index) => ({
    _id: id(node.type),
    type: node.type,
    title: node.title,
    statement: node.statement,
    domain: node.domain,
    source: { paper_id: paperId, location: { page: node.page, section: node.section } },
    embeddings: vectors[index] ?? { semantic: [], structural: [], proof: [], technique: [], domain: [] },
    metadata: { formalized: node.formalized ?? false, confidence: node.confidence ?? 0.7 },
    createdAt: now,
    updatedAt: now,
  }));
  if (nodes.length) {
    await collections.paperNodes.insertMany(nodes);
    await collections.graphNodes.insertMany(nodes.map((node) => ({ _id: id("graph"), entityType: node.type.toUpperCase() as never, entityId: node._id, label: node.title, metadata: { paperId }, createdAt: now, updatedAt: now })));
  }
  return { paper_id: paperId, filename, pages: parsed.pages, node_count: nodes.length, nodes };
}

app.get("/health", async () => ({ status: "ok", service: "api-papers" }));

async function paperEmbedHandler(request: { file: () => Promise<any> }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  const upload = await request.file();
  if (!upload) return reply.code(400).send({ error: "Expected a multipart PDF field named file" });
  try {
    const buffer = await upload.toBuffer();
    const result = await processPaper(buffer, upload.filename, upload.mimetype);
    return reply.code(201).send(result);
  } catch (error) {
    console.error("paper processing failed", error);
    return reply.code(500).send({ error: error instanceof Error ? error.message : "Paper processing failed" });
  }
}

app.post("/paper-embbed", paperEmbedHandler);
app.post("/paper-embed", paperEmbedHandler);

await app.listen({ port: config.port, host: "0.0.0.0" });
console.log(`Paper API listening on http://localhost:${config.port}`);
