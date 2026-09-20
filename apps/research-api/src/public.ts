// Anonymous read API for the published atlas — port of MathLab's public.py.
// Serves only the public projection (publication rows) plus atlas structure;
// nothing here can launch work or reveal private records.

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  EVIDENCE_LABELS,
  PROBLEM_STATUS_LABELS,
  getCollections,
  latestPublications,
  serializePublication,
} from "@triviality/database";
import type { PublicationDocument } from "@triviality/database";

function serializeAll(pubs: PublicationDocument[]): Record<string, unknown>[] {
  return pubs.map(serializePublication);
}

export function registerPublicRoutes(app: FastifyInstance): void {
  app.get("/public/areas", async () => {
    const collections = await getCollections();
    const [areas, counts] = await Promise.all([
      collections.atlasAreas.find({}).sort({ depth: 1, name: 1 }).toArray(),
      collections.relations
        .aggregate<{ _id: string; n: number }>([
          { $match: { layer: "atlas", kind: "classified_in" } },
          { $group: { _id: "$targetId", n: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
    const countByArea = new Map(counts.map((c) => [c._id, c.n]));
    return areas.map((a) => ({
      id: a._id,
      slug: a.slug,
      name: a.name,
      description: a.description ?? "",
      parent_id: a.parentId,
      depth: a.depth,
      problem_count: countByArea.get(a._id) ?? 0,
    }));
  });

  app.get(
    "/public/problems",
    async (request: FastifyRequest<{ Querystring: { area?: string } }>) => {
      const collections = await getCollections();
      let pubs = serializeAll(await latestPublications(collections, "problem"));
      const area = request.query.area;
      if (area) {
        pubs = pubs.filter((p) =>
          (p.areas as { slug: string }[] | undefined)?.some((a) => a.slug === area),
        );
      }
      return pubs.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    },
  );

  app.get(
    "/public/problems/:slug",
    async (request: FastifyRequest<{ Params: { slug: string } }>, reply) => {
      const collections = await getCollections();
      const problems = await latestPublications(collections, "problem");
      const pub = problems.find((p) => p.publicPayload.slug === request.params.slug);
      if (!pub) return reply.code(404).send({ error: "No published problem with that slug" });
      const problemId = pub.recordId;

      const [campaignPubs, ideaPubs, claimPubs, evidencePubs] = await Promise.all([
        latestPublications(collections, "campaign"),
        latestPublications(collections, "idea"),
        latestPublications(collections, "claim"),
        latestPublications(collections, "evidence"),
      ]);
      const campaigns = campaignPubs.filter((c) => c.publicPayload.problem_id === problemId);
      const ideas = ideaPubs.filter((i) => i.publicPayload.problem_id === problemId);
      const ideaIds = new Set(ideas.map((i) => i.recordId));
      const claims = claimPubs.filter(
        (c) => ideaIds.has(String(c.publicPayload.idea_id)) || c.publicPayload.problem_id === problemId,
      );
      const evidence = evidencePubs.filter(
        (e) =>
          ideaIds.has(String(e.publicPayload.idea_id)) ||
          e.publicPayload.problem_id === problemId,
      );
      return {
        problem: serializePublication(pub),
        campaigns: serializeAll(campaigns),
        ideas: serializeAll(ideas),
        claims: serializeAll(claims),
        evidence: serializeAll(evidence),
      };
    },
  );

  app.get(
    "/public/ideas/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const collections = await getCollections();
      const idea = (await latestPublications(collections, "idea")).find(
        (p) => p.recordId === request.params.id,
      );
      if (!idea) return reply.code(404).send({ error: "No published idea with that id" });
      const [claimPubs, evidencePubs] = await Promise.all([
        latestPublications(collections, "claim"),
        latestPublications(collections, "evidence"),
      ]);
      return {
        idea: serializePublication(idea),
        claims: serializeAll(
          claimPubs.filter((c) => c.publicPayload.idea_id === idea.recordId),
        ),
        evidence: serializeAll(
          evidencePubs.filter((e) => e.publicPayload.idea_id === idea.recordId),
        ),
      };
    },
  );

  app.get(
    "/public/graph",
    async (
      request: FastifyRequest<{ Querystring: { layers?: string; problem?: string } }>,
    ) => {
      const collections = await getCollections();
      const wanted = new Set(
        (request.query.layers ?? "atlas,lineage,dependency,association").split(","),
      );
      const nodes = new Map<string, Record<string, unknown>>();
      const areas = await collections.atlasAreas.find({}).toArray();
      if (wanted.has("atlas")) {
        for (const a of areas) {
          nodes.set(a._id, {
            id: a._id,
            type: "area",
            label: a.name,
            slug: a.slug,
            depth: a.depth,
            parent_id: a.parentId,
          });
        }
      }

      let problems = await latestPublications(collections, "problem");
      const problemSlug = request.query.problem;
      if (problemSlug) problems = problems.filter((p) => p.publicPayload.slug === problemSlug);
      const problemIds = new Set(problems.map((p) => p.recordId));
      for (const p of problems) {
        nodes.set(p.recordId, {
          id: p.recordId,
          type: "problem",
          label: p.publicPayload.title,
          slug: p.publicPayload.slug,
          status: p.publicPayload.status,
          evidence_label: p.evidenceLabel,
          areas: (p.publicPayload.areas as { slug: string }[] | undefined)?.map((a) => a.slug) ?? [],
        });
      }

      const ideas = (await latestPublications(collections, "idea")).filter((i) =>
        problemIds.has(String(i.publicPayload.problem_id)),
      );
      for (const i of ideas) {
        const pl = i.publicPayload;
        nodes.set(i.recordId, {
          id: i.recordId,
          type: "idea",
          label: pl.title,
          problem_id: pl.problem_id,
          generation: pl.generation,
          depth: pl.depth,
          evidence_status: pl.evidence_status,
          scheduling_status: pl.scheduling_status,
          formalization_status: pl.formalization_status,
          evidence_label: i.evidenceLabel,
          score: pl.score,
          method_tags: pl.method_tags,
        });
      }
      const ideaIds = new Set(ideas.map((i) => i.recordId));
      const claims = (await latestPublications(collections, "claim")).filter((c) =>
        ideaIds.has(String(c.publicPayload.idea_id)) || problemIds.has(String(c.publicPayload.problem_id)),
      );
      for (const c of claims) {
        nodes.set(c.recordId, {
          id: c.recordId,
          type: "claim",
          label: String(c.publicPayload.statement ?? "").slice(0, 80),
          idea_id: c.publicPayload.idea_id,
          evidence_label: c.evidenceLabel,
          formalization_status: c.publicPayload.formalization_status,
        });
      }

      const links: Record<string, unknown>[] = [];
      if (wanted.has("atlas")) {
        for (const a of areas) {
          if (a.parentId && nodes.has(a.parentId)) {
            links.push({ source: a._id, target: a.parentId, layer: "atlas", kind: "subfield_of" });
          }
        }
      }
      const relations = await collections.relations
        .find({ layer: { $in: [...wanted] } })
        .toArray();
      for (const r of relations) {
        if (nodes.has(r.sourceId) && nodes.has(r.targetId)) {
          links.push({
            source: r.sourceId,
            target: r.targetId,
            layer: r.layer,
            kind: r.kind,
            status: r.status,
          });
        }
      }
      return { nodes: [...nodes.values()], links, layers: [...wanted].sort() };
    },
  );

  app.get(
    "/public/events",
    async (
      request: FastifyRequest<{ Querystring: { since_id?: string; limit?: string } }>,
    ) => {
      const collections = await getCollections();
      const sinceId = Math.max(0, Number(request.query.since_id ?? 0) || 0);
      const limit = Math.min(1000, Math.max(1, Number(request.query.limit ?? 200) || 200));
      const rows = await collections.publicEvents
        .find({ seq: { $gt: sinceId } })
        .sort({ seq: 1 })
        .limit(limit)
        .toArray();
      return rows.map((e) => ({
        id: e.seq,
        type: e.type,
        record_type: e.recordType,
        record_id: e.recordId,
        payload: e.payload,
        created_at: e.createdAt.toISOString(),
      }));
    },
  );

  app.get("/public/labels", async () => ({
    evidence: EVIDENCE_LABELS,
    problem_status: PROBLEM_STATUS_LABELS,
  }));
}
