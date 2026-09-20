import type { DatabaseCollections } from "./client.js";
import { withdrawPublication } from "./publisher.js";

/** Withdraw every public version of legacy run questions; keep research history. */
export async function retireRunQuestions(collections: DatabaseCollections): Promise<string[]> {
  const candidates = await collections.atlasProblems.find({
    origin: "generated", attribution: "Triviality research episode",
  }).toArray();
  const retired: string[] = [];
  for (const candidate of candidates) {
    const problem = await collections.researchProblems.findOne({ _id: candidate._id });
    if (!problem || !await collections.researchEpisodes.findOne({ _id: problem.episodeId })) continue;
    const publications = await collections.publications.find({
      recordType: "problem", recordId: candidate._id, withdrawnAt: null,
    }).toArray();
    for (const publication of publications) {
      await withdrawPublication(collections, publication._id,
        "permanent: Research runs belong in research history, not the question bank.");
    }
    if (publications.length) retired.push(candidate._id);
  }
  return retired;
}
