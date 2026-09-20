import assert from "node:assert/strict";
import test from "node:test";
import { searchLiterature } from "../dist/literature.js";

function fixture(fetch) {
  const records = new Map([
    ["relevant", { _id: "relevant", title: "Natural number order", abstract: "Addition preserves order", citedByCount: 2 }],
    ["popular", { _id: "popular", title: "Natural geometry", citedByCount: 999 }],
    ["distant", { _id: "distant", title: "Graph invariants", citedByCount: 10 }],
  ]);
  const state = { links: [], samples: 0 };
  const collections = {
    papers: {
      find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [records.get("popular"), records.get("relevant")] }) }) }),
      aggregate: () => { state.samples++; return { toArray: async () => [records.get("distant")] }; },
      updateOne: async ({ _id }, update) => records.set(_id, { _id, ...update.$setOnInsert, ...update.$set }),
      findOne: async ({ _id }) => records.get(_id),
      updateMany: async (filter, update) => state.links.push({ filter, update }),
    },
    paperNodes: { find: () => ({ limit: () => ({ toArray: async () => [
      { _id: "lemma", type: "lemma", statement: "Order lemma", source: { paper_id: "relevant", location: { page: 2, section: "1" } }, metadata: { formalized: false } },
    ] }) }) },
  };
  return { state, dependencies: { getCollections: async () => collections, fetch } };
}

test("offline retrieval ranks the existing bank and includes extracted evidence", async () => {
  const { state, dependencies } = fixture(async () => { throw new Error("offline"); });
  const result = await searchLiterature("episode", "natural number order addition", false, dependencies);
  assert.equal(result.papers[0].id, "relevant");
  assert.equal(result.papers[0].extractedKnowledge[0].status, "extracted_unverified");
  assert.match(result.warning, /existing literature bank/);
  assert.equal(state.samples, 0);
  assert.equal(state.links[0].update.$addToSet["rawMetadata.episodeIds"], "episode");
});

test("broader restart retrieval adds corpus samples and deduplicates live papers", async () => {
  const work = { id: "https://openalex.org/W123", title: "Order proof", abstract_inverted_index: { Addition: [0], works: [1] } };
  const { state, dependencies } = fixture(async () => ({ ok: true, json: async () => ({ results: [work, work] }) }));
  const result = await searchLiterature("episode", "order", true, dependencies);
  assert.equal(state.samples, 1);
  assert(result.papers.some((paper) => paper.id === "distant"));
  assert.equal(result.papers.filter((paper) => paper.title === "Order proof").length, 1);
  assert.equal(result.papers.find((paper) => paper.title === "Order proof").abstract, "Addition works");
});
