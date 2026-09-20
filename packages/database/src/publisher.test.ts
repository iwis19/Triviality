import assert from "node:assert/strict";
import { test } from "node:test";
import type { DatabaseCollections } from "./client.js";
import { projectPublication, publishEpisode } from "./publisher.js";
import { retireRunQuestions } from "./retire-run-questions.js";

function fixture(atlasProblemId?: string) {
  const publications: any[] = [];
  const now = new Date();
  const episode = { _id: "episode", createdAt: now, atlasProblemId };
  const atlas = { _id: "catalogue", origin: "literature", assertions: [{}], areaIds: [], title: "Catalogue question" };
  const empty = { find: () => ({ toArray: async () => [] }) };
  const collections = {
    researchEpisodes: { findOne: async () => episode },
    researchProblems: { findOne: async () => ({ _id: "run-question", episodeId: "episode", title: "Addition preserves order" }) },
    researchAttempts: { countDocuments: async () => 0 },
    researchHypotheses: empty, claims: empty, formalizations: empty, researchResults: empty,
    atlasProblems: { findOne: async () => atlas, updateOne: async () => assert.fail("Runs must never insert catalogue questions") },
    atlasAreas: empty,
    publications: { findOne: async () => null, insertOne: async (p: any) => publications.push(p) },
    publicEvents: { insertOne: async () => {} }, counters: { findOneAndUpdate: async () => ({ seq: 1 }) },
  } as unknown as DatabaseCollections;
  return { collections, publications, atlas };
}

test("repeated ad-hoc runs publish campaigns without adding questions", async () => {
  const { collections, publications } = fixture();
  await publishEpisode(collections, "episode");
  await publishEpisode(collections, "episode");
  assert.deepEqual(publications.map(p => p.recordType), ["campaign", "campaign"]);
});

test("runs linked to catalogue questions retain their existing question", async () => {
  const { collections, publications } = fixture("catalogue");
  await publishEpisode(collections, "episode");
  assert.equal(publications.find(p => p.recordType === "problem").recordId, "catalogue");
  assert.equal(publications.find(p => p.recordType === "campaign").publicPayload.problem_id, "catalogue");
});

test("legacy run-generated questions cannot be republished", async () => {
  const { collections, atlas, publications } = fixture();
  Object.assign(atlas, { origin: "generated", attribution: "Triviality research episode" });
  assert.equal(await projectPublication(collections, "problem", atlas._id), false);
  assert.equal(publications.length, 0);
});

test("cleanup withdraws all versions only for confirmed run questions and is repeatable", async () => {
  const { collections } = fixture();
  const rows = [{ _id: "v1", recordType: "problem", recordId: "run-question", withdrawnAt: null as Date | null },
    { _id: "v2", recordType: "problem", recordId: "run-question", withdrawnAt: null as Date | null }];
  collections.atlasProblems.find = (() => ({ toArray: async () => [{ _id: "run-question" }, { _id: "unrelated" }] })) as any;
  collections.researchProblems.findOne = (async ({ _id }: any) => _id === "run-question" ? { episodeId: "episode" } : null) as any;
  collections.publications.find = (() => ({ toArray: async () => rows.filter(p => !p.withdrawnAt) })) as any;
  collections.publications.findOne = (async ({ _id }: any) => rows.find(p => p._id === _id)) as any;
  collections.publications.updateOne = (async ({ _id }: any, update: any) => Object.assign(rows.find(p => p._id === _id)!, update.$set)) as any;
  assert.deepEqual(await retireRunQuestions(collections), ["run-question"]);
  assert.ok(rows.every(p => p.withdrawnAt));
  assert.deepEqual(await retireRunQuestions(collections), []);
});
