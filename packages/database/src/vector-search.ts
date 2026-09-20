import { getCollections } from "./client.js";

export async function findSimilarPapers(vector: number[], limit = 10) {
  const collections = await getCollections();
  return collections.paperEmbeddings.aggregate([
    { $vectorSearch: { index: "paper_embedding_vector", path: "embedding", queryVector: vector, numCandidates: Math.max(limit * 20, 100), limit } },
    { $project: { _id: 0, paperId: 1, model: 1, score: { $meta: "vectorSearchScore" } } },
  ]).toArray();
}
