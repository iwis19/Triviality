import { randomUUID } from "node:crypto";
import { getCollections, type PaperDocument } from "@triviality/database";
import { config } from "./config.js";
import { OpenAIEmbeddingProvider } from "./embedding.js";
import { JobState } from "./job-state.js";
import { abstractFromInvertedIndex, fetchTopMathPapersByArea, paperSourceUrl } from "./openalex.js";
import { storeRawMetadata } from "./storage.js";

const embeddingProvider = new OpenAIEmbeddingProvider();

export async function ingestTopMathPapers(): Promise<{ runId: string; discovered: number; areaHits: number; areas: Record<string, number>; embedded: number }> {
  const runId = randomUUID();
  const state = new JobState();
  await state.start(runId);
  let embedded = 0;

  try {
    const batches = await fetchTopMathPapersByArea();
    const areaCounts = Object.fromEntries(batches.map((batch) => [batch.area.slug, batch.works.length]));
    const grouped = new Map<string, { work: (typeof batches)[number]["works"][number]; areas: Array<{ slug: string; label: string; rank: number }> }>();
    for (const batch of batches) {
      batch.works.forEach((work, index) => {
        const existing = grouped.get(work.id) ?? { work, areas: [] };
        existing.areas.push({ slug: batch.area.slug, label: batch.area.label, rank: index + 1 });
        grouped.set(work.id, existing);
      });
    }
    const works = [...grouped.values()];
    const collections = await getCollections();
    for (const entry of works) {
      const work = entry.work;
      const externalId = work.id;
      const title = work.title?.trim() || "Untitled mathematical work";
      const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
      const landingUrl = paperSourceUrl(work);
      const rawArtifact = await storeRawMetadata(externalId, work);

      const sourceId = (await collections.sources.findOne({ provider: "OPENALEX", externalId }))?._id ?? randomUUID();
      await collections.sources.updateOne({ provider: "OPENALEX", externalId }, { $set: { canonicalUrl: landingUrl, metadata: work, updatedAt: new Date() }, $setOnInsert: { _id: sourceId, createdAt: new Date() } }, { upsert: true });

      const paperId = (await collections.papers.findOne({ externalId }))?._id ?? randomUUID();
      const areaLabels = entry.areas.map((area) => area.label);
      const paper: PaperDocument = { _id: paperId, createdAt: new Date(), updatedAt: new Date(), externalId, title, abstract: abstract ?? undefined, doi: work.doi ?? undefined, authors: work.authorships?.map((item) => item.author?.display_name).filter((value): value is string => Boolean(value)), subjects: [...new Set([...areaLabels, ...(work.topics ?? []).map((topic) => topic.display_name).filter((value): value is string => Boolean(value))])], publishedAt: work.publication_date ? new Date(work.publication_date) : undefined, citedByCount: work.cited_by_count ?? 0, landingUrl, openAccessUrl: work.open_access?.oa_url ?? work.primary_location?.pdf_url ?? undefined, rawMetadata: { ...work, ingestion_areas: entry.areas } };
      const { _id: _paperId, createdAt: _createdAt, ...paperFields } = paper;
      await collections.papers.updateOne({ externalId }, { $set: { ...paperFields, updatedAt: new Date() }, $setOnInsert: { _id: paperId, createdAt: paper.createdAt } }, { upsert: true });

      await collections.paperSources.updateOne({ paperId, sourceId }, { $set: { retrievedAt: new Date() }, $setOnInsert: { _id: randomUUID(), paperId, sourceId, createdAt: new Date() } }, { upsert: true });
      for (const area of entry.areas) {
        await collections.paperDiscoveries.updateOne({ paperId, area: area.slug }, { $set: { areaLabel: area.label, rank: area.rank, retrievedAt: new Date(), updatedAt: new Date() }, $setOnInsert: { _id: randomUUID(), paperId, provider: "OPENALEX", area: area.slug, createdAt: new Date() } }, { upsert: true });
      }
      await collections.objectArtifacts.updateOne({ storageKey: rawArtifact.key }, { $set: { checksum: rawArtifact.checksum, byteSize: rawArtifact.bytes, updatedAt: new Date() }, $setOnInsert: { _id: randomUUID(), bucket: rawArtifact.bucket, storageKey: rawArtifact.key, kind: "RAW_METADATA", mimeType: "application/json", paperId, createdAt: new Date() } }, { upsert: true });
      await collections.graphNodes.updateOne({ entityType: "PAPER", entityId: paperId }, { $set: { label: title, metadata: { externalId, source: "openalex" }, updatedAt: new Date() }, $setOnInsert: { _id: randomUUID(), entityType: "PAPER", entityId: paperId, createdAt: new Date() } }, { upsert: true });

      const vector = await embeddingProvider.embed(`${title}\n${abstract ?? ""}`);
      if (vector) {
        await collections.paperEmbeddings.updateOne({ paperId, model: embeddingProvider.model }, { $set: { dimensions: vector.length, embedding: vector, updatedAt: new Date() }, $setOnInsert: { _id: randomUUID(), paperId, model: embeddingProvider.model, createdAt: new Date() } }, { upsert: true });
        embedded += 1;
      }
    }
    const areaHits = Object.values(areaCounts).reduce((sum, count) => sum + count, 0);
    await state.complete(runId, { discovered: works.length, areaHits, areas: areaCounts, embedded });
    return { runId, discovered: works.length, areaHits, areas: areaCounts, embedded };
  } catch (error) {
    await state.fail(runId, error);
    throw error;
  }
}

export function startScheduler(): NodeJS.Timeout {
  const interval = config.intervalMinutes * 60 * 1000;
  return setInterval(() => void ingestTopMathPapers().catch((error) => console.error("paper ingestion failed", error)), interval);
}
