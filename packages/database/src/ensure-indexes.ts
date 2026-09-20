import { getCollections, getDatabase, getMongoClient } from "./client.js";

export async function ensureIndexes(): Promise<void> {
  const collections = await getCollections();
  await Promise.all([
    collections.researchEpisodes.createIndex({ projectId: 1, createdAt: -1 }),
    collections.researchProblems.createIndex({ episodeId: 1 }),
    collections.researchHypotheses.createIndex({ episodeId: 1, createdAt: 1 }),
    collections.researchAttempts.createIndex({ episodeId: 1, createdAt: 1 }),
    collections.researchResults.createIndex({ episodeId: 1, createdAt: 1 }),
    collections.researchEvents.createIndex({ episodeId: 1, createdAt: 1 }),
    collections.formalizations.createIndex({ episodeId: 1 }),
    collections.papers.createIndex({ "rawMetadata.episodeId": 1, createdAt: 1 }),
    collections.papers.createIndex({ "rawMetadata.episodeIds": 1, createdAt: 1 }),
    collections.papers.createIndex({ externalId: 1 }, { unique: true }),
    collections.sources.createIndex({ provider: 1, externalId: 1 }, { unique: true }),
    collections.paperSources.createIndex({ paperId: 1, sourceId: 1 }, { unique: true }),
    collections.paperDiscoveries.createIndex({ paperId: 1, area: 1 }, { unique: true }),
    collections.paperDiscoveries.createIndex({ area: 1, rank: 1 }),
    collections.paperEmbeddings.createIndex({ paperId: 1, model: 1 }, { unique: true }),
    collections.paperNodes.createIndex({ "source.paper_id": 1, type: 1 }),
    collections.graphNodes.createIndex({ entityType: 1, entityId: 1 }, { unique: true }),
    collections.graphNodes.createIndex({ "metadata.episodeIds": 1, createdAt: 1 }),
    collections.graphRelationships.createIndex({ fromNodeId: 1, toNodeId: 1, type: 1 }, { unique: true }),
    collections.graphRelationships.createIndex({ "metadata.episodeIds": 1, createdAt: 1 }),
    collections.papers.createIndex({ citedByCount: -1 }),
    collections.atlasAreas.createIndex({ slug: 1 }, { unique: true }),
    collections.atlasAreas.createIndex({ parentId: 1 }),
    collections.atlasProblems.createIndex({ slug: 1 }, { unique: true }),
    collections.atlasProblems.createIndex({ areaIds: 1 }),
    collections.claims.createIndex({ contentHash: 1 }),
    collections.claims.createIndex({ problemId: 1, claimVersion: -1 }),
    collections.claims.createIndex({ hypothesisId: 1, claimVersion: -1 }),
    collections.relations.createIndex({ layer: 1, kind: 1 }),
    collections.relations.createIndex({ sourceId: 1, targetId: 1 }),
    collections.publications.createIndex({ recordType: 1, recordId: 1, recordVersion: 1 }, { unique: true }),
    collections.publications.createIndex({ recordType: 1, withdrawnAt: 1, publishedAt: 1 }),
    collections.publicEvents.createIndex({ seq: 1 }, { unique: true }),
  ]);

  try {
    const db = await getDatabase();
    await db.collection("paper_embeddings").createSearchIndex({
      name: "paper_embedding_vector",
      type: "vectorSearch",
      definition: { fields: [{ type: "vector", path: "embedding", numDimensions: 1536, similarity: "cosine" }] },
    } as never);
    await db.collection("paper_nodes").createSearchIndex({
      name: "paper_node_embedding_vector",
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "vector", path: "embeddings.semantic", numDimensions: 1536, similarity: "cosine" },
          { type: "vector", path: "embeddings.structural", numDimensions: 1536, similarity: "cosine" },
          { type: "vector", path: "embeddings.proof", numDimensions: 1536, similarity: "cosine" },
          { type: "vector", path: "embeddings.technique", numDimensions: 1536, similarity: "cosine" },
          { type: "vector", path: "embeddings.domain", numDimensions: 1536, similarity: "cosine" },
        ],
      },
    } as never);
  } catch (error) {
    console.warn("Atlas Vector Search index was not created; create it in Atlas or use a local MongoDB instance without search indexes.", error instanceof Error ? error.message : error);
  }
}

if (process.argv[1]?.endsWith("ensure-indexes.ts")) {
  await ensureIndexes();
  console.log("MongoDB indexes ensured");
  await (await getMongoClient()).close();
}
