import OpenAI from "openai";
import pdfParse from "pdf-parse";
import { nodeTypes, extractionSystemPrompt, type ExtractedNode } from "./prompt.js";
import { config } from "./config.js";

const openai = new OpenAI({ apiKey: config.openAiKey });

function isNodeType(value: unknown): value is ExtractedNode["type"] {
  return typeof value === "string" && (nodeTypes as readonly string[]).includes(value);
}

function normalizeNode(value: unknown, fallbackPage: number): ExtractedNode | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!isNodeType(candidate.type) || typeof candidate.title !== "string" || typeof candidate.statement !== "string") return null;
  const domains = Array.isArray(candidate.domain) ? candidate.domain.filter((item): item is string => typeof item === "string") : [];
  return {
    type: candidate.type,
    title: candidate.title.trim(),
    statement: candidate.statement.trim(),
    domain: domains.length ? domains : ["mathematics"],
    page: typeof candidate.page === "number" && candidate.page > 0 ? candidate.page : fallbackPage,
    section: typeof candidate.section === "string" ? candidate.section : "",
    formalized: candidate.formalized === true,
    confidence: typeof candidate.confidence === "number" ? Math.max(0, Math.min(1, candidate.confidence)) : 0.7,
  };
}

export async function extractPdfNodes(buffer: Buffer): Promise<{ pages: number; text: string; nodes: ExtractedNode[] }> {
  const parsed = await pdfParse(buffer);
  const rawPages = parsed.text.split(/\f/);
  const pages = rawPages.length > 1 ? rawPages : [parsed.text];
  const chunks: Array<{ text: string; firstPage: number }> = [];
  let current = "";
  let firstPage = 1;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index].trim();
    if (!page) continue;
    if (current && (current.length + page.length > 24000 || index - firstPage > 7)) {
      chunks.push({ text: current, firstPage });
      current = "";
      firstPage = index + 1;
    }
    current += `\n\n[PAGE ${index + 1}]\n${page}`;
  }
  if (current) chunks.push({ text: current, firstPage });

  const nodes: ExtractedNode[] = [];
  for (const chunk of chunks) {
    const completion = await openai.chat.completions.create({
      model: config.openAiModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: extractionSystemPrompt },
        { role: "user", content: `Extract nodes from these paper pages. The first page in this chunk is ${chunk.firstPage}.\n\n${chunk.text}` },
      ],
    });
    const content = completion.choices[0]?.message.content ?? "{\"nodes\":[]}";
    const payload = JSON.parse(content) as { nodes?: unknown[] };
    for (const candidate of payload.nodes ?? []) {
      const node = normalizeNode(candidate, chunk.firstPage);
      if (node?.title && node.statement) nodes.push(node);
    }
  }
  return { pages: parsed.numpages || pages.length, text: parsed.text, nodes };
}

export async function createNodeEmbeddings(nodes: ExtractedNode[]): Promise<Array<ExtractedNode["type"] extends never ? never : { semantic: number[]; structural: number[]; proof: number[]; technique: number[]; domain: number[] }>> {
  const inputs = nodes.flatMap((node) => [
    `Semantic mathematical meaning:\n${node.title}\n${node.statement}`,
    `Structural mathematical relationships and objects:\n${node.title}\n${node.statement}`,
    `Proof obligations and argument pattern:\n${node.title}\n${node.statement}`,
    `Mathematical techniques used or suggested:\n${node.title}\n${node.statement}`,
    `Mathematical domains:\n${node.domain.join(", ")}\n${node.title}`,
  ]);
  if (!inputs.length) return [];
  const response = await openai.embeddings.create({ model: config.embeddingModel, input: inputs });
  const vectors = response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  return nodes.map((_, index) => ({ semantic: vectors[index * 5] ?? [], structural: vectors[index * 5 + 1] ?? [], proof: vectors[index * 5 + 2] ?? [], technique: vectors[index * 5 + 3] ?? [], domain: vectors[index * 5 + 4] ?? [] }));
}
