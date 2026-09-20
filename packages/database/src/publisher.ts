// Port of MathLab's publication service to the MongoDB read model.
//
// Publication is a projection, never a verification step: the evidence label is
// derived from the record's independent status dimensions and copied verbatim
// onto the public payload. A changed record version publishes a new publication
// row; old versions remain for replay. Withdrawal is explicit.

import { createHash, randomUUID } from "node:crypto";
import type { DatabaseCollections } from "./client.js";
import type { ClaimDocument, PublicationDocument } from "./types.js";

export const PUBLICATION_POLICY_VERSION = "v1";

export const EVIDENCE_LABELS: Record<string, string> = {
  lean_verified: "Lean verified",
  lean_formalization_in_progress: "Lean formalization in progress",
  informal_proof_candidate: "Informal proof candidate — not formally verified",
  proof_sketch: "Proof sketch — not verified",
  counterexample_checked: "Computationally checked on a finite range — not a proof",
  empirically_supported: "Empirical support only — not a proof",
  unresolved_conflict: "Reported refutation — awaiting independent check",
  refuted: "Refuted",
  untested: "Untested hypothesis",
};

export const PROBLEM_STATUS_LABELS: Record<string, string> = {
  unreviewed: "Status unreviewed",
  reported_open: "Reported open by cited sources",
  resolution_claimed: "Resolution claimed — under review",
  resolved: "Resolved (reviewed)",
  disputed: "Status disputed",
  unknown: "Status unknown",
};

export function evidenceLabel(status: string): string {
  return EVIDENCE_LABELS[status] ?? "Untested hypothesis";
}

function newId(): string {
  return randomUUID().replaceAll("-", "");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function payloadVersion(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex").slice(0, 32);
}

export async function nextSeq(collections: DatabaseCollections, name: string): Promise<number> {
  const doc = await collections.counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return doc?.seq ?? 1;
}

export async function appendPublicEvent(
  collections: DatabaseCollections,
  type: string,
  recordType: string,
  recordId: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const seq = await nextSeq(collections, "publicEvents");
  await collections.publicEvents.insertOne({
    _id: `pubevent_${seq}`,
    seq,
    type,
    recordType,
    recordId,
    payload,
    createdAt: new Date(),
  });
  return seq;
}

// --- read model ---------------------------------------------------------------

/** Latest non-withdrawn version per record, MathLab semantics: sort by
 *  publishedAt and keep the last write per (recordType, recordId). */
export async function latestPublications(
  collections: DatabaseCollections,
  recordType?: string,
): Promise<PublicationDocument[]> {
  const filter: Record<string, unknown> = { withdrawnAt: { $in: [null, undefined] } };
  if (recordType) filter.recordType = recordType;
  const rows = await collections.publications.find(filter).sort({ publishedAt: 1 }).toArray();
  const latest = new Map<string, PublicationDocument>();
  for (const row of rows) latest.set(`${row.recordType}:${row.recordId}`, row);
  return [...latest.values()];
}

export function serializePublication(pub: PublicationDocument): Record<string, unknown> {
  return {
    record_type: pub.recordType,
    record_id: pub.recordId,
    version: pub.recordVersion,
    evidence_label: pub.evidenceLabel,
    policy_version: pub.policyVersion,
    published_at: pub.publishedAt.toISOString(),
    ...pub.publicPayload,
  };
}

// --- projections (allow-listed fields only) -----------------------------------

type BuiltPayload = { payload: Record<string, unknown>; label: string } | null;

async function buildProblem(collections: DatabaseCollections, problemId: string): Promise<BuiltPayload> {
  const problem = await collections.atlasProblems.findOne({ _id: problemId });
  if (!problem) return null;
  // Never publish an unsourced literature problem.
  if (problem.origin !== "generated" && problem.assertions.length === 0) return null;
  const areas = await collections.atlasAreas.find({ _id: { $in: problem.areaIds } }).toArray();
  const coverage = problem.coverage ?? {};
  const payload = {
    id: problem._id,
    slug: problem.slug,
    title: problem.title,
    statement: problem.statement,
    definitions: problem.definitions ?? "",
    assumptions: problem.assumptions ?? "",
    origin: problem.origin,
    attribution: problem.attribution ?? "",
    status: problem.status,
    status_checked_at: problem.statusCheckedAt ?? "",
    formal_target: problem.formalTarget ?? "",
    formal_target_status: problem.formalTargetStatus ?? "absent",
    areas: areas.map((a) => ({ slug: a.slug, name: a.name })),
    sources: problem.assertions.map((a) => ({
      title: a.sourceTitle,
      url: a.sourceUrl,
      location: a.location ?? "",
      asserted_status: a.assertedStatus,
      asserted_at: a.assertedAt ?? "",
      retrieved_date: a.retrievedDate ?? "",
      review_state: a.reviewState,
    })),
    status_reviews: (coverage.status_reviews ?? []).map((r) => ({
      reviewer: r.reviewer, date: r.date, from: r.from, to: r.to, note: r.note,
    })),
    reference_formalization: coverage.reference_formalization,
  };
  return { payload, label: PROBLEM_STATUS_LABELS[problem.status] ?? "Status unknown" };
}

async function buildIdea(collections: DatabaseCollections, ideaId: string): Promise<BuiltPayload> {
  const hypothesis = await collections.researchHypotheses.findOne({ _id: ideaId });
  if (!hypothesis) return null;
  const problemId = hypothesis.atlasProblemId ?? hypothesis.problemId;
  const claims = await collections.claims.find({ hypothesisId: hypothesis._id }).toArray();
  const consequences = (hypothesis.expectedConsequences ?? {}) as Record<string, unknown>;
  const evidenceStatus =
    hypothesis.status === "VERIFIED" ? "lean_verified"
    : hypothesis.status === "DISPROVED" ? "refuted"
    : "untested";
  const payload = {
    id: hypothesis._id,
    campaign_id: hypothesis.episodeId,
    problem_id: problemId ?? null,
    title: hypothesis.rationale?.slice(0, 120) || hypothesis.statement.slice(0, 120) || "Research hypothesis",
    approach: String(consequences.approach ?? hypothesis.rationale ?? ""),
    mechanism: hypothesis.statement,
    next_experiment: String(consequences.nextStep ?? ""),
    novelty_rationale: "",
    method_tags: [] as string[],
    generation: 0,
    depth: 0,
    parent_ids: [] as string[],
    scheduling_status: hypothesis.status === "ABANDONED" ? "archived" : "active",
    evidence_status: evidenceStatus,
    review_status: "unreviewed",
    novelty_status: "unchecked",
    formalization_status: "absent",
    score: hypothesis.plausibilityEstimate ?? 0,
    pinned: false,
    claim_ids: claims.map((c) => c._id),
    created_at: hypothesis.createdAt.toISOString(),
  };
  return { payload, label: evidenceLabel(evidenceStatus) };
}

async function buildClaim(collections: DatabaseCollections, claimId: string): Promise<BuiltPayload> {
  const claim = await collections.claims.findOne({ _id: claimId });
  if (!claim) return null;
  // Verification only counts when the checker certified this exact version.
  const verified = await collections.formalizations.findOne({
    claimId: claim._id, claimVersion: claim.claimVersion, verified: true,
  });
  const status = verified
    ? "lean_verified"
    : claim.formalizationStatus === "in_progress" || claim.formalizationStatus === "queued"
      ? "lean_formalization_in_progress"
      : "untested";
  const payload = {
    id: claim._id,
    idea_id: claim.hypothesisId ?? claim.sourceIdeaId ?? null,
    campaign_id: claim.sourceCampaignId ?? claim.episodeId ?? null,
    problem_id: claim.problemId ?? null,
    statement: claim.statement,
    scope: claim.scope ?? "",
    lean_declaration: claim.leanDeclaration ?? "",
    claim_version: claim.claimVersion,
    content_hash: claim.contentHash,
    formalization_status: claim.formalizationStatus,
    previous_version_id: claim.previousVersionId ?? null,
  };
  return { payload, label: evidenceLabel(status) };
}

async function buildEvidence(collections: DatabaseCollections, evidenceId: string): Promise<BuiltPayload> {
  // Evidence records are backed by a formalization or an episode-level result.
  const formalization = await collections.formalizations.findOne({ _id: evidenceId });
  if (formalization) {
    const payload = {
      id: formalization._id,
      idea_id: null,
      claim_id: formalization.claimId ?? null,
      problem_id: null,
      claim_version: formalization.claimVersion ?? 0,
      check_type: "lean_check",
      result: formalization.verified ? "verified" : "rejected",
      summary: formalization.explanation ?? formalization.theoremName ?? "Lean check",
      coverage: "",
      verifier: formalization.checker ?? "swarmflow-lean",
      verifier_version: formalization.systemVersion ?? "lean4",
      certified: true, // the swarm's Lean toolchain is the independent lab checker
      assumptions: [] as string[],
      axioms: formalization.axioms ?? [],
      reasons: [] as string[],
      check_status: formalization.verified ? "verified" : "rejected",
      approved_target: formalization.statement ?? null,
      target_origin: null,
      toolchain: formalization.systemVersion ?? null,
      artifact_id: null,
      created_at: formalization.createdAt.toISOString(),
    };
    const label = formalization.verified ? "Lean verified" : "Lean check rejected";
    return { payload, label };
  }
  const result = await collections.researchResults.findOne({ _id: evidenceId });
  if (!result) return null;
  const payload = {
    id: result._id,
    idea_id: result.hypothesisId ?? null,
    claim_id: null,
    problem_id: null,
    claim_version: 0,
    check_type: "episode_result",
    result: result.status === "VERIFIED" ? "supports" : result.status === "DISPROVED" ? "refutes" : "inconclusive",
    summary: result.summary,
    coverage: "",
    verifier: "workswarm",
    verifier_version: "SwarmFlow",
    certified: false,
    assumptions: [] as string[],
    axioms: [] as string[],
    reasons: [] as string[],
    check_status: result.status,
    approved_target: null,
    target_origin: null,
    toolchain: null,
    artifact_id: null,
    created_at: result.createdAt.toISOString(),
  };
  return { payload, label: `Worker-reported episode_result — not independently certified` };
}

async function buildCampaign(collections: DatabaseCollections, episodeId: string): Promise<BuiltPayload> {
  const episode = await collections.researchEpisodes.findOne({ _id: episodeId });
  if (!episode) return null;
  const sessionsUsed = await collections.researchAttempts.countDocuments({ episodeId });
  const problem = await collections.researchProblems.findOne({ episodeId });
  const state = episode.status === "ABANDONED" ? "failed" : episode.completedAt ? "completed" : "active";
  const payload = {
    id: episode._id,
    problem_id: episode.atlasProblemId ?? problem?._id ?? null,
    state,
    generation: 1,
    session_budget: episode.budget ?? 0,
    sessions_used: sessionsUsed,
    policy_version: PUBLICATION_POLICY_VERSION,
    default_mode: episode.mode ?? "workswarm",
    created_at: episode.createdAt.toISOString(),
  };
  return { payload, label: `Campaign ${state}` };
}

export type PublishableType = "problem" | "idea" | "claim" | "evidence" | "campaign";

const BUILDERS: Record<PublishableType, (c: DatabaseCollections, id: string) => Promise<BuiltPayload>> = {
  problem: buildProblem,
  idea: buildIdea,
  claim: buildClaim,
  evidence: buildEvidence,
  campaign: buildCampaign,
};

/** Project one record into the public read model. Returns true when a new
 *  publication row was written. Idempotent on identical payload versions. */
export async function projectPublication(
  collections: DatabaseCollections,
  recordType: PublishableType,
  recordId: string,
): Promise<boolean> {
  const built = await BUILDERS[recordType](collections, recordId);
  if (!built) return false;
  const version = payloadVersion(built.payload);
  const existing = await collections.publications.findOne({ recordType, recordId, recordVersion: version });
  if (existing) return false;
  const withdrawn = await collections.publications.findOne({
    recordType, recordId, withdrawalReason: { $regex: "^permanent:" },
  });
  if (withdrawn) return false;
  const eventSeq = await nextSeq(collections, "publicEvents");
  const now = new Date();
  await collections.publications.insertOne({
    _id: `pub_${newId()}`,
    recordType,
    recordId,
    recordVersion: version,
    publicPayload: built.payload,
    evidenceLabel: built.label,
    policyVersion: PUBLICATION_POLICY_VERSION,
    eventSeq,
    publishedAt: now,
    withdrawnAt: null,
    withdrawalReason: "",
  });
  await collections.publicEvents.insertOne({
    _id: `pubevent_${eventSeq}`,
    seq: eventSeq,
    type: "publication.created",
    recordType,
    recordId,
    payload: { version, label: built.label },
    createdAt: now,
  });
  return true;
}

export async function withdrawPublication(
  collections: DatabaseCollections,
  publicationId: string,
  reason: string,
): Promise<void> {
  const pub = await collections.publications.findOne({ _id: publicationId });
  if (!pub || pub.withdrawnAt) return;
  await collections.publications.updateOne(
    { _id: publicationId },
    { $set: { withdrawnAt: new Date(), withdrawalReason: reason } },
  );
  await appendPublicEvent(collections, "publication.withdrawn", pub.recordType, pub.recordId, { reason });
}

// --- claims ------------------------------------------------------------------

function contentHash(statement: string): string {
  return createHash("sha256").update(statement.trim()).digest("hex");
}

/** Record a claim under the versioned-claim rule: an unchanged statement reuses
 *  the latest claim for its anchor; an edited statement creates a new claim
 *  version that never inherits the old version's verification. */
export async function recordClaimVersion(
  collections: DatabaseCollections,
  input: {
    statement: string;
    scope?: string;
    leanDeclaration?: string;
    formalizationStatus?: string;
    episodeId?: string;
    problemId?: string;
    hypothesisId?: string;
  },
): Promise<ClaimDocument> {
  const hash = contentHash(input.statement);
  const anchor = input.hypothesisId
    ? { hypothesisId: input.hypothesisId }
    : input.problemId
      ? { problemId: input.problemId }
      : { episodeId: input.episodeId };
  const latest = await collections.claims.find(anchor).sort({ claimVersion: -1 }).limit(1).next();
  const now = new Date();
  if (latest && latest.contentHash === hash) {
    if (input.formalizationStatus && input.formalizationStatus !== latest.formalizationStatus) {
      await collections.claims.updateOne(
        { _id: latest._id },
        { $set: { formalizationStatus: input.formalizationStatus, updatedAt: now } },
      );
      latest.formalizationStatus = input.formalizationStatus;
    }
    return latest;
  }
  const claim: ClaimDocument = {
    _id: `claim_${newId().slice(0, 24)}`,
    statement: input.statement,
    scope: input.scope ?? "",
    leanDeclaration: input.leanDeclaration ?? "",
    contentHash: hash,
    claimVersion: (latest?.claimVersion ?? 0) + 1,
    previousVersionId: latest?._id,
    formalizationStatus: input.formalizationStatus ?? "absent",
    episodeId: input.episodeId,
    problemId: input.problemId,
    hypothesisId: input.hypothesisId,
    createdAt: now,
    updatedAt: now,
  };
  await collections.claims.insertOne(claim);
  return claim;
}

async function addRelation(
  collections: DatabaseCollections,
  layer: string,
  kind: string,
  sourceType: string,
  sourceId: string,
  targetType: string,
  targetId: string,
): Promise<void> {
  const now = new Date();
  await collections.relations.updateOne(
    { kind, sourceType, sourceId, targetType, targetId },
    { $set: { layer, status: "checked", updatedAt: now }, $setOnInsert: { _id: `rel_${newId()}`, provenance: {}, createdAt: now } },
    { upsert: true },
  );
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "problem";
}

/** Publish a completed research episode into the public read model: the episode
 *  becomes a campaign record, hypotheses become ideas, claims keep their
 *  version, and formalizations/results publish as evidence. */
export async function publishEpisode(collections: DatabaseCollections, episodeId: string): Promise<number> {
  const episode = await collections.researchEpisodes.findOne({ _id: episodeId });
  if (!episode) return 0;
  let published = 0;

  // Resolve or materialize the atlas problem this episode worked on.
  let atlasProblemId = episode.atlasProblemId;
  if (!atlasProblemId) {
    const problem = await collections.researchProblems.findOne({ episodeId });
    if (problem) {
      const slug = `${slugify(problem.title)}-${episodeId.slice(-6)}`;
      const now = new Date();
      await collections.atlasProblems.updateOne(
        { _id: problem._id },
        {
          $set: {
            slug, title: problem.title, statement: problem.statement,
            assumptions: typeof problem.assumptions === "string" ? problem.assumptions : "",
            origin: "generated", attribution: "Triviality research episode",
            status: episode.status === "VERIFIED" ? "resolution_claimed" : "unreviewed",
            areaIds: [], assertions: [], updatedAt: now,
          },
          $setOnInsert: { coverage: {}, createdAt: now },
        },
        { upsert: true },
      );
      atlasProblemId = problem._id;
    }
  }
  if (atlasProblemId && (await projectPublication(collections, "problem", atlasProblemId))) published += 1;
  if (await projectPublication(collections, "campaign", episodeId)) published += 1;

  const hypotheses = await collections.researchHypotheses.find({ episodeId }).toArray();
  for (const hypothesis of hypotheses) {
    if (atlasProblemId) {
      await collections.researchHypotheses.updateOne(
        { _id: hypothesis._id }, { $set: { atlasProblemId } },
      );
      await addRelation(collections, "lineage", "proposed_for", "idea", hypothesis._id, "problem", atlasProblemId);
    }
    if (await projectPublication(collections, "idea", hypothesis._id)) published += 1;
  }

  const claims = await collections.claims.find({ episodeId }).toArray();
  for (const claim of claims) {
    if (claim.hypothesisId) {
      await addRelation(collections, "dependency", "addresses", "idea", claim.hypothesisId, "claim", claim._id);
    } else if (atlasProblemId) {
      await addRelation(collections, "dependency", "addresses", "problem", atlasProblemId, "claim", claim._id);
    }
    if (await projectPublication(collections, "claim", claim._id)) published += 1;
  }

  const formalizations = await collections.formalizations.find({ episodeId }).toArray();
  for (const formalization of formalizations) {
    if (await projectPublication(collections, "evidence", formalization._id)) published += 1;
  }
  const results = await collections.researchResults.find({ episodeId }).toArray();
  for (const result of results) {
    if (await projectPublication(collections, "evidence", result._id)) published += 1;
  }
  return published;
}
