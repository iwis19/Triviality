import "dotenv/config";
import { Collection, Db, MongoClient } from "mongodb";
import type {
  ConjectureDocument, CounterexampleDocument, DefinitionDocument, FailureDocument, FormalizationDocument,
  GraphNodeDocument, GraphRelationshipDocument, LemmaDocument, MathematicalStructureDocument, ObjectArtifactDocument,
  PaperDiscoveryDocument, PaperDocument, PaperEmbeddingDocument, PaperKnowledgeNodeDocument, PaperSourceDocument, ProofStrategyDocument, ResearchAttemptDocument,
  ResearchEpisodeDocument, ResearchHypothesisDocument, ResearchProblemDocument, ResearchProjectDocument, ResearchResultDocument,
  ResearchEventDocument, ResearchDiscoveryDocument,
  SourceDocument, TechniqueDocument, TheoremDocument,
  AtlasAreaDocument, AtlasProblemDocument, ClaimDocument, CounterDocument, PublicationDocument, PublicEventDocument, RelationDocument,
} from "./types.js";

export function getMongoUri(): string {
  return process.env.MONGODB_URI ?? "mongodb://localhost:27017";
}

export function getMongoDatabaseName(): string {
  return process.env.MONGODB_DATABASE ?? "triviality";
}

let clientPromise: Promise<MongoClient> | undefined;

export async function getMongoClient(): Promise<MongoClient> {
  clientPromise ??= new MongoClient(getMongoUri()).connect();
  return clientPromise;
}

export async function getDatabase(): Promise<Db> {
  return (await getMongoClient()).db(getMongoDatabaseName());
}

export interface DatabaseCollections {
  researchProjects: Collection<ResearchProjectDocument>;
  researchEpisodes: Collection<ResearchEpisodeDocument>;
  researchProblems: Collection<ResearchProblemDocument>;
  researchHypotheses: Collection<ResearchHypothesisDocument>;
  researchAttempts: Collection<ResearchAttemptDocument>;
  researchResults: Collection<ResearchResultDocument>;
  researchEvents: Collection<ResearchEventDocument>;
  researchDiscoveries: Collection<ResearchDiscoveryDocument>;
  papers: Collection<PaperDocument>;
  theorems: Collection<TheoremDocument>;
  lemmas: Collection<LemmaDocument>;
  definitions: Collection<DefinitionDocument>;
  conjectures: Collection<ConjectureDocument>;
  techniques: Collection<TechniqueDocument>;
  proofStrategies: Collection<ProofStrategyDocument>;
  mathematicalStructures: Collection<MathematicalStructureDocument>;
  counterexamples: Collection<CounterexampleDocument>;
  failures: Collection<FailureDocument>;
  formalizations: Collection<FormalizationDocument>;
  sources: Collection<SourceDocument>;
  paperSources: Collection<PaperSourceDocument>;
  paperDiscoveries: Collection<PaperDiscoveryDocument>;
  objectArtifacts: Collection<ObjectArtifactDocument>;
  paperEmbeddings: Collection<PaperEmbeddingDocument>;
  paperNodes: Collection<PaperKnowledgeNodeDocument>;
  graphNodes: Collection<GraphNodeDocument>;
  graphRelationships: Collection<GraphRelationshipDocument>;
  atlasAreas: Collection<AtlasAreaDocument>;
  atlasProblems: Collection<AtlasProblemDocument>;
  claims: Collection<ClaimDocument>;
  relations: Collection<RelationDocument>;
  publications: Collection<PublicationDocument>;
  publicEvents: Collection<PublicEventDocument>;
  counters: Collection<CounterDocument>;
}

export async function getCollections(): Promise<DatabaseCollections> {
  const db = await getDatabase();
  return {
    researchProjects: db.collection("research_projects"), researchEpisodes: db.collection("research_episodes"),
    researchProblems: db.collection("research_problems"), researchHypotheses: db.collection("research_hypotheses"),
    researchAttempts: db.collection("research_attempts"), researchResults: db.collection("research_results"),
    researchEvents: db.collection("research_events"),
    researchDiscoveries: db.collection("research_discoveries"),
    papers: db.collection("papers"), theorems: db.collection("theorems"), lemmas: db.collection("lemmas"),
    definitions: db.collection("definitions"), conjectures: db.collection("conjectures"), techniques: db.collection("techniques"),
    proofStrategies: db.collection("proof_strategies"), mathematicalStructures: db.collection("mathematical_structures"),
    counterexamples: db.collection("counterexamples"), failures: db.collection("failures"), formalizations: db.collection("formalizations"),
    sources: db.collection("sources"), paperSources: db.collection("paper_sources"), paperDiscoveries: db.collection("paper_discoveries"), objectArtifacts: db.collection("object_artifacts"),
    paperEmbeddings: db.collection("paper_embeddings"), paperNodes: db.collection("paper_nodes"), graphNodes: db.collection("graph_nodes"), graphRelationships: db.collection("graph_relationships"),
    atlasAreas: db.collection("atlas_areas"), atlasProblems: db.collection("atlas_problems"),
    claims: db.collection("claims"), relations: db.collection("relations"),
    publications: db.collection("publications"), publicEvents: db.collection("public_events"), counters: db.collection("counters"),
  };
}
