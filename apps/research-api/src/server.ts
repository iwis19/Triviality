import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import { Redis } from "ioredis";
import { getCollections, getDatabase, getMongoClient, proofDocument } from "@triviality/database";
import { catalog, validateRoleModels } from "./models.js";
import { config } from "./config.js";

type CreateJobBody = {
  title?: string;
  statement?: string;
  area?: string;
  roleModels?: unknown;
  provider?: string; // Compatibility with the frontend before per-role selection.
  mode?: string;
  budget?: number;
  leanStatement?: string;
};

const app = Fastify({ logger: true });
const redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function publicStatus(status: string): "running" | "completed" | "failed" {
  if (status === "ACTIVE" || status === "UNEXPLORED") return "running";
  if (status === "ABANDONED" || status === "DISPROVED") return "failed";
  return "completed";
}

function metadataOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function emit(episodeId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  const collections = await getCollections();
  await collections.researchEvents.insertOne({
    _id: id("event"),
    episodeId,
    type,
    payload,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function serializeJob(episodeId: string) {
  const collections = await getCollections();
  const episode = await collections.researchEpisodes.findOne({ _id: episodeId });
  if (!episode) return null;

  const [problem, hypotheses, attempts, results, papers, formalization, graphNodes, graphEdges, events] = await Promise.all([
    collections.researchProblems.findOne({ episodeId }),
    collections.researchHypotheses.find({ episodeId }).sort({ createdAt: 1 }).toArray(),
    collections.researchAttempts.find({ episodeId }).sort({ createdAt: 1 }).toArray(),
    collections.researchResults.find({ episodeId }).sort({ createdAt: 1 }).toArray(),
    collections.papers.find({ $or: [{ "rawMetadata.episodeId": episodeId }, { "rawMetadata.episodeIds": episodeId }] }).sort({ createdAt: 1 }).toArray(),
    collections.formalizations.findOne({ episodeId }),
    collections.graphNodes.find({ $or: [{ "metadata.episodeId": episodeId }, { "metadata.episodeIds": episodeId }] }).sort({ createdAt: 1 }).toArray(),
    collections.graphRelationships.find({ $or: [{ "metadata.episodeId": episodeId }, { "metadata.episodeIds": episodeId }] }).sort({ createdAt: 1 }).toArray(),
    collections.researchEvents.find({ episodeId }).sort({ createdAt: 1 }).toArray(),
  ]);

  const graph = graphNodes.map((node) => {
    const metadata = metadataOf(node.metadata);
    return {
      id: node.entityId,
      type: String(metadata.type ?? node.entityType.toLowerCase().replace("research_", "")),
      label: node.label,
      detail: String(metadata.detail ?? ""),
      x: Number(metadata.x ?? 50),
      y: Number(metadata.y ?? 50),
      status: String(metadata.status ?? "candidate"),
    };
  });

  // Older episodes retained the writer's explanation inside the result evidence.
  const savedOutcome = results.map((result) => metadataOf(metadataOf(result.evidence).outcome)).find((outcome) => outcome.proof);
  const savedExplanation = metadataOf(savedOutcome?.proof).explanation;
  const explanation = formalization?.explanation ?? (typeof savedExplanation === "string" ? savedExplanation : "");
  const proof = formalization ? {
    status: formalization.verified ? "verified" : "candidate",
    theoremName: formalization.theoremName ?? "research_result",
    statement: formalization.statement ?? "",
    lean: formalization.leanSource ?? "",
    explanation,
    latex: formalization.latexSource?.trim() || proofDocument(episode.title, problem?.statement ?? episode.objective, explanation, `${episode.summary ?? ""}\n\n${formalization.checker ?? "No checker result recorded."}`),
    checker: formalization.checker ?? formalization.verificationLog ?? "No independent checker result recorded.",
    axioms: formalization.axioms ?? [],
  } : undefined;

  return {
    id: episode._id,
    projectId: episode.projectId,
    problemId: problem?._id,
    title: episode.title,
    statement: problem?.statement ?? episode.objective,
    researchSpace: {
      name: episode.title,
      statement: problem?.statement ?? episode.objective,
      assumptions: problem?.assumptions ?? "",
    },
    area: episode.area ?? "Mathematics",
    orchestrator: episode.orchestrator,
    roleModels: episode.roleModels,
    configuration: {
      orchestrator: episode.orchestrator,
      roleModels: episode.roleModels,
      provider: episode.modelProvider ?? (episode.orchestrator ? undefined : "openai"),
      mode: episode.mode ?? "Diverse portfolio",
      budget: episode.budget ?? 0,
    },
    mode: episode.mode ?? "Diverse portfolio",
    provider: episode.modelProvider ?? (episode.orchestrator ? undefined : "openai"),
    budget: episode.budget ?? 0,
    leanStatement: episode.leanStatement,
    status: publicStatus(episode.status),
    stage: episode.stage ?? "Research queued",
    progress: episode.progress ?? 0,
    createdAt: episode.createdAt.toISOString(),
    completedAt: episode.completedAt?.toISOString(),
    summary: episode.summary ?? "",
    error: episode.error,
    nodes: graph,
    edges: graphEdges.map((edge) => ({
      source: edge.fromNodeId,
      target: edge.toNodeId,
      label: String(metadataOf(edge.metadata).label ?? edge.type.toLowerCase()),
    })),
    literature: papers.map((paper) => {
      const metadata = metadataOf(paper.rawMetadata);
      return {
        id: paper._id,
        title: paper.title,
        authors: (paper.authors ?? []).join(", "),
        source: String(metadata.source ?? "OpenAlex"),
        year: String(paper.publishedAt?.getFullYear() ?? "n.d."),
        summary: paper.abstract ?? "No abstract was available for this source.",
        relevance: String(metadata.relevance ?? "Retrieved for the current research target."),
        discovery: String(metadata.discovery ?? "seed"),
        matchedQuery: String(metadata.matchedQuery ?? ""),
        url: paper.landingUrl ?? paper.openAccessUrl ?? "#",
      };
    }),
    hypotheses: hypotheses.map((hypothesis) => ({
      id: hypothesis._id,
      title: hypothesis.rationale.slice(0, 72) || "Research hypothesis",
      statement: hypothesis.statement,
      approach: String((hypothesis.expectedConsequences as { approach?: string } | undefined)?.approach ?? "Candidate direction"),
      status: hypothesis.status === "DISPROVED" ? "disproved" : hypothesis.status === "PROMISING" ? "promising" : "candidate",
      score: hypothesis.plausibilityEstimate,
    })),
    attempts: attempts.map((attempt) => ({
      id: attempt._id,
      role: String((attempt.input as { role?: string } | undefined)?.role ?? "research worker"),
      strategy: attempt.strategy,
      status: attempt.status === "SUCCEEDED" ? "completed" : attempt.status === "FAILED" ? "failed" : "running",
      result: attempt.proofState ?? attempt.error ?? "Attempt recorded.",
    })),
    proof,
    results: results.map((result) => ({ id: result._id, hypothesisId: result.hypothesisId, attemptId: result.attemptId, title: result.title, summary: result.summary, status: result.status, evidence: result.evidence })),
    events: events.map((event) => ({ id: event._id, type: event.type, payload: event.payload, createdAt: event.createdAt.toISOString() })),
  };
}

app.get("/health", async (_request, reply) => {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    if (redis.status === "wait") await redis.connect();
    await redis.ping();
    return { status: "ok", service: "research-api", mongo: "ok", redis: "ok" };
  } catch (error) {
    return reply.code(503).send({ status: "degraded", error: error instanceof Error ? error.message : "dependency unavailable" });
  }
});

app.post("/research/jobs", async (request: FastifyRequest<{ Body: CreateJobBody }>, reply) => {
  const body = request.body ?? {};
  const title = body.title?.trim();
  const statement = body.statement?.trim();
  if (!title || !statement) return reply.code(400).send({ error: "title and statement are required" });

  const now = new Date();
  const projectId = id("project");
  const episodeId = id("episode");
  const problemId = id("problem");
  const area = body.area?.trim() || "Mathematics";
  let roleModels: Record<string, string>;
  try {
    // The integration branch also serves the older single-provider frontend.
    const selections = body.roleModels === undefined
      ? Object.fromEntries(catalog.roles.map((role) => [role.id, body.provider === "devin" ? "devin/agent" : catalog.defaultModel]))
      : body.roleModels;
    roleModels = validateRoleModels(selections);
  }
  catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
  const mode = body.mode?.trim() || "Diverse portfolio";
  const budget = Math.max(1, Math.min(6, Number(body.budget ?? 2)));
  if (!Number.isFinite(budget) || !Number.isInteger(budget)) return reply.code(400).send({ error: "budget must be an integer" });
  if (body.leanStatement !== undefined && (typeof body.leanStatement !== "string" || body.leanStatement.length > 6000)) return reply.code(400).send({ error: "leanStatement must be a string of at most 6000 characters" });
  const collections = await getCollections();
  await collections.researchProjects.insertOne({ _id: projectId, name: title, description: statement, status: "ACTIVE", createdAt: now, updatedAt: now });
  await collections.researchEpisodes.insertOne({ _id: episodeId, projectId, title, objective: statement, status: "ACTIVE", area, orchestrator: "workswarm", roleModels, mode, budget, leanStatement: body.leanStatement?.trim() || undefined, stage: "Queued for research worker", progress: 2, createdAt: now, updatedAt: now });
  await collections.researchProblems.insertOne({ _id: problemId, episodeId, title, statement, assumptions: "", status: "ACTIVE", createdAt: now, updatedAt: now });

  try {
    if (redis.status === "wait") await redis.connect();
    await redis.lpush("triviality:research:jobs", JSON.stringify({ episodeId }));
    await emit(episodeId, "research.job.created", { projectId, episodeId, problemId, title, statement, area, orchestrator: "workswarm", roleModels, mode, budget });
  } catch (error) {
    await collections.researchEpisodes.updateOne({ _id: episodeId }, { $set: { status: "ABANDONED", stage: "Queue unavailable", error: error instanceof Error ? error.message : "Redis unavailable", updatedAt: new Date() } });
    return reply.code(503).send({ error: "Research queue unavailable. Start Redis and retry." });
  }

  return reply.code(202).send(await serializeJob(episodeId));
});

app.get("/research/jobs", async () => {
  const collections = await getCollections();
  const episodes = await collections.researchEpisodes.find({}).sort({ createdAt: -1 }).toArray();
  return (await Promise.all(episodes.map((episode) => serializeJob(episode._id)))).filter(Boolean);
});

app.get("/research/jobs/:jobId", async (request: FastifyRequest<{ Params: { jobId: string } }>, reply) => {
  const job = await serializeJob(request.params.jobId);
  return job ? job : reply.code(404).send({ error: "Research job not found" });
});

app.get("/research/jobs/:jobId/events", async (request: FastifyRequest<{ Params: { jobId: string } }>) => {
  const collections = await getCollections();
  return collections.researchEvents.find({ episodeId: request.params.jobId }).sort({ createdAt: 1 }).toArray();
});

app.addHook("onClose", async () => {
  await redis.quit();
  await (await getMongoClient()).close();
});

await app.listen({ port: config.port, host: "0.0.0.0" });
console.log(`Research API listening on http://localhost:${config.port}`);
