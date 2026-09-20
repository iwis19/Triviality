// One-shot migration: copy the MathLab SQLite atlas + publication snapshot into
// the MongoDB read model. Idempotent — rows upsert by their original ids.
//
// Usage: pnpm --filter @triviality/database migrate-mathlab [path/to/mathlab.db]
// Default path: newest *.db under <repo>/external/norththehackers/snapshots/.

import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AnyBulkWriteOperation, Collection } from "mongodb";
import { getCollections, getMongoClient } from "./client.js";
import type { AtlasSourceAssertion, AtlasStatusReview } from "./types.js";

function findSnapshot(): string {
  const arg = process.argv[2] ?? process.env.MATHLAB_SNAPSHOT;
  if (arg) {
    const path = resolve(arg);
    if (!existsSync(path)) throw new Error(`Snapshot not found: ${path}`);
    return path;
  }
  let dir = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    const snapshots = join(dir, "external", "norththehackers", "snapshots");
    if (existsSync(snapshots)) {
      const dbs = readdirSync(snapshots).filter((f) => f.endsWith(".db")).sort();
      if (dbs.length) return join(snapshots, dbs[dbs.length - 1]);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("No snapshot path given and none found under external/norththehackers/snapshots/");
}

function parseDate(value: unknown): Date {
  if (typeof value !== "string" || !value) return new Date();
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withTz = /[Z+-]\d{0,2}:?\d{0,2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withTz);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

type Row = Record<string, unknown>;

async function upsertAll<T extends { _id: string }>(
  collection: Collection<T>,
  docs: T[],
  label: string,
): Promise<void> {
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const ops: AnyBulkWriteOperation<T>[] = chunk.map((doc) => ({
      replaceOne: { filter: { _id: doc._id } as never, replacement: doc, upsert: true },
    }));
    await collection.bulkWrite(ops);
  }
  console.log(`${label}: ${docs.length}`);
}

async function main(): Promise<void> {
  const path = findSnapshot();
  console.log(`Migrating ${path}`);
  const sqlite = new DatabaseSync(path, { readOnly: true });
  const q = (sql: string): Row[] => sqlite.prepare(sql).all() as Row[];
  const now = new Date();
  const collections = await getCollections();

  const areas = q("select id, slug, name, description, parent_id, depth from areas").map((r) => ({
    _id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: String(r.description ?? ""),
    parentId: r.parent_id == null ? null : String(r.parent_id),
    depth: Number(r.depth ?? 0),
    createdAt: now,
    updatedAt: now,
  }));
  await upsertAll(collections.atlasAreas, areas, "atlasAreas");

  const areaIds = new Map<string, string[]>();
  for (const row of q("select problem_id, area_id from problem_areas")) {
    const list = areaIds.get(String(row.problem_id)) ?? [];
    list.push(String(row.area_id));
    areaIds.set(String(row.problem_id), list);
  }
  const assertions = new Map<string, AtlasSourceAssertion[]>();
  for (const row of q(
    `select sa.problem_id, sa.location, sa.asserted_status, sa.asserted_at, sa.review_state, sa.notes,
            s.url, s.title, s.authors, s.publisher, s.published_date, s.retrieved_date, s.reuse_policy
     from source_assertions sa join sources s on s.id = sa.source_id`,
  )) {
    const list = assertions.get(String(row.problem_id)) ?? [];
    list.push({
      sourceUrl: String(row.url ?? ""),
      sourceTitle: String(row.title ?? ""),
      authors: String(row.authors ?? ""),
      publisher: String(row.publisher ?? ""),
      publishedDate: String(row.published_date ?? ""),
      retrievedDate: String(row.retrieved_date ?? ""),
      reusePolicy: String(row.reuse_policy ?? ""),
      location: String(row.location ?? ""),
      assertedStatus: String(row.asserted_status ?? ""),
      assertedAt: String(row.asserted_at ?? ""),
      reviewState: String(row.review_state ?? "unreviewed"),
      notes: String(row.notes ?? ""),
    });
    assertions.set(String(row.problem_id), list);
  }
  const problems = q("select * from problems").map((r) => ({
    _id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    statement: String(r.statement ?? ""),
    definitions: String(r.definitions ?? ""),
    assumptions: String(r.assumptions ?? ""),
    origin: String(r.origin ?? "literature"),
    attribution: String(r.attribution ?? ""),
    status: String(r.status ?? "unreviewed"),
    statusCheckedAt: String(r.status_checked_at ?? ""),
    formalTarget: String(r.formal_target ?? ""),
    formalTargetStatus: String(r.formal_target_status ?? "absent"),
    coverage: parseJson<{ status_reviews?: AtlasStatusReview[]; reference_formalization?: unknown }>(r.coverage, {}),
    areaIds: areaIds.get(String(r.id)) ?? [],
    assertions: assertions.get(String(r.id)) ?? [],
    createdAt: parseDate(r.created_at),
    updatedAt: now,
  }));
  await upsertAll(collections.atlasProblems, problems, "atlasProblems");

  const relations = q("select * from relations").map((r) => ({
    _id: String(r.id),
    layer: String(r.layer),
    kind: String(r.kind),
    sourceType: String(r.source_type),
    sourceId: String(r.source_id),
    targetType: String(r.target_type),
    targetId: String(r.target_id),
    confidence: r.confidence == null ? undefined : Number(r.confidence),
    status: String(r.status ?? "proposed"),
    provenance: parseJson<Record<string, unknown>>(r.provenance, {}),
    createdAt: parseDate(r.created_at),
    updatedAt: now,
  }));
  await upsertAll(collections.relations, relations, "relations");

  const claims = q("select * from claims").map((r) => ({
    _id: String(r.id),
    statement: String(r.statement ?? ""),
    scope: String(r.scope ?? ""),
    leanDeclaration: String(r.lean_declaration ?? ""),
    contentHash: String(r.content_hash ?? ""),
    claimVersion: Number(r.version ?? 1),
    previousVersionId: r.previous_version_id == null ? undefined : String(r.previous_version_id),
    formalizationStatus: String(r.formalization_status ?? "absent"),
    sourceIdeaId: r.idea_id == null ? undefined : String(r.idea_id),
    sourceCampaignId: r.campaign_id == null ? undefined : String(r.campaign_id),
    createdAt: parseDate(r.created_at),
    updatedAt: now,
  }));
  await upsertAll(collections.claims, claims, "claims");

  const publications = q("select * from publications").map((r) => ({
    _id: String(r.id),
    recordType: String(r.record_type),
    recordId: String(r.record_id),
    recordVersion: String(r.record_version),
    publicPayload: parseJson<Record<string, unknown>>(r.public_payload, {}),
    evidenceLabel: String(r.evidence_label ?? ""),
    policyVersion: String(r.policy_version ?? "v1"),
    eventSeq: r.event_id == null ? undefined : Number(r.event_id),
    publishedAt: parseDate(r.published_at),
    withdrawnAt: r.withdrawn_at == null ? null : parseDate(r.withdrawn_at),
    withdrawalReason: String(r.withdrawal_reason ?? ""),
  }));
  await upsertAll(collections.publications, publications, "publications");

  const publicEvents = q("select id, type, record_type, record_id, payload, created_at from events where visibility = 'public' order by id").map((r) => ({
    _id: `pubevent_${Number(r.id)}`,
    seq: Number(r.id),
    type: String(r.type),
    recordType: String(r.record_type ?? ""),
    recordId: String(r.record_id ?? ""),
    payload: parseJson<Record<string, unknown>>(r.payload, {}),
    createdAt: parseDate(r.created_at),
  }));
  await upsertAll(collections.publicEvents, publicEvents, "publicEvents");

  const maxSeq = publicEvents.reduce((max, e) => Math.max(max, e.seq), 0);
  await collections.counters.updateOne(
    { _id: "publicEvents" },
    { $max: { seq: maxSeq } },
    { upsert: true },
  );

  sqlite.close();
  console.log("Migration complete");
  await (await getMongoClient()).close();
}

await main();
