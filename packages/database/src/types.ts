export type ResearchStatus = "UNEXPLORED" | "ACTIVE" | "PROMISING" | "FORMALIZING" | "VERIFIED" | "DISPROVED" | "ABANDONED";
export type AttemptStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type ResultStatus = "CANDIDATE" | "VERIFIED" | "DISPROVED" | "PUBLISHED";

export type GraphEntityType =
  | "RESEARCH_PROJECT" | "RESEARCH_EPISODE" | "RESEARCH_PROBLEM" | "RESEARCH_HYPOTHESIS"
  | "RESEARCH_ATTEMPT" | "RESEARCH_RESULT" | "PAPER" | "THEOREM" | "LEMMA" | "DEFINITION"
  | "CONJECTURE" | "TECHNIQUE" | "PROOF_STRATEGY" | "MATHEMATICAL_STRUCTURE"
  | "COUNTEREXAMPLE" | "FAILURE" | "FORMALIZATION";

export type RelationshipType =
  | "CITES" | "EXTENDS" | "GENERALIZES" | "SPECIALIZES" | "IMPROVES" | "CONTRADICTS"
  | "USES" | "DEPENDS_ON" | "EQUIVALENT_TO" | "ANALOGOUS_TO" | "STRUCTURALLY_SIMILAR"
  | "SHARES_ASSUMPTION" | "SHARES_CONSTRUCTION" | "SHARES_PROOF_PATTERN" | "SHARES_INVARIANT"
  | "DUAL_OF" | "USES_METHOD" | "APPLIES_TO" | "FAILS_ON" | "TRANSFER_CANDIDATE"
  | "SUPPORTS" | "PRODUCES";

export type SourceProvider = "OPENALEX" | "ARXIV" | "CROSSREF" | "USER_UPLOAD" | "LEAN" | "OTHER";
export type ArtifactKind = "PDF" | "HTML" | "ABSTRACT" | "RAW_METADATA" | "EXTRACTED_TEXT" | "FORMAL_PROOF" | "EXPERIMENT";

export interface BaseDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchProjectDocument extends BaseDocument { name: string; description?: string; status: ResearchStatus; }
export interface ResearchEpisodeDocument extends BaseDocument {
  projectId: string;
  title: string;
  objective: string;
  status: ResearchStatus;
  area?: string;
  modelProvider?: string;
  orchestrator?: "workswarm";
  roleModels?: Record<string, string>;
  mode?: string;
  budget?: number;
  explorationRounds?: number;
  stagnationThreshold?: number;
  branches?: unknown[];
  leanStatement?: string;
  stage?: string;
  progress?: number;
  summary?: string;
  error?: string;
  completedAt?: Date;
}
export interface ResearchProblemDocument extends BaseDocument { episodeId: string; title: string; statement: string; assumptions?: unknown; status: ResearchStatus; }
export interface ResearchHypothesisDocument extends BaseDocument { episodeId: string; problemId?: string; statement: string; rationale: string; assumptions?: unknown; expectedConsequences?: unknown; noveltyEstimate?: number; plausibilityEstimate?: number; formalizability?: number; status: ResearchStatus; }
export interface ResearchAttemptDocument extends BaseDocument { episodeId: string; hypothesisId: string; proofStrategyId?: string; strategy: string; status: AttemptStatus; input?: unknown; proofState?: string; error?: string; startedAt?: Date; completedAt?: Date; }
export interface ResearchResultDocument extends BaseDocument { episodeId: string; hypothesisId?: string; attemptId?: string; title: string; summary: string; status: ResultStatus; evidence?: unknown; }
export interface ResearchEventDocument extends BaseDocument { episodeId: string; type: string; payload: Record<string, unknown>; }
export interface ResearchDiscoveryDocument extends BaseDocument {
  episodeId: string; discoveryId: string; branch: number; generation: number; round: number;
  kind: string; status: string; content: string; source_ids?: string[]; discovery_ids?: string[];
  evidence?: string; resolution_test?: string; reason?: string; claim?: string; log?: string;
}

export interface PaperDocument extends BaseDocument { externalId: string; title: string; abstract?: string; doi?: string; authors?: string[]; subjects: string[]; publishedAt?: Date; citedByCount: number; relevanceScore?: number; landingUrl?: string; openAccessUrl?: string; rawMetadata?: unknown; }
export interface TheoremDocument extends BaseDocument { paperId?: string; name: string; statement: string; assumptions?: unknown; }
export interface LemmaDocument extends BaseDocument { paperId?: string; name: string; statement: string; assumptions?: unknown; }
export interface DefinitionDocument extends BaseDocument { paperId?: string; name: string; statement: string; }
export interface ConjectureDocument extends BaseDocument { paperId?: string; name: string; statement: string; status: ResearchStatus; }
export interface TechniqueDocument extends BaseDocument { name: string; description: string; }
export interface ProofStrategyDocument extends BaseDocument { techniqueId?: string; name: string; description: string; }
export interface MathematicalStructureDocument extends BaseDocument { name: string; description: string; axioms?: unknown; }
export interface CounterexampleDocument extends BaseDocument { failureId?: string; statement: string; construction?: unknown; source?: string; }
export interface FailureDocument extends BaseDocument { attemptId?: string; kind: string; message: string; lesson?: string; violatedAssumption?: string; }
export interface FormalizationDocument extends BaseDocument {
  episodeId?: string;
  attemptId?: string;
  theoremId?: string;
  lemmaId?: string;
  system: string;
  systemVersion?: string;
  sourceArtifactId?: string;
  verified: boolean;
  verificationLog?: string;
  theoremName?: string;
  statement?: string;
  leanSource?: string;
  latexSource?: string;
  explanation?: string;
  checker?: string;
  axioms?: string[];
}

export interface SourceDocument extends BaseDocument { provider: SourceProvider; externalId: string; canonicalUrl: string; metadata?: unknown; }
export interface PaperSourceDocument extends BaseDocument { paperId: string; sourceId: string; rank?: number; retrievedAt: Date; }
export interface PaperDiscoveryDocument extends BaseDocument { paperId: string; provider: SourceProvider; area: string; areaLabel: string; rank: number; retrievedAt: Date; }
export interface ObjectArtifactDocument extends BaseDocument { bucket: string; storageKey: string; kind: ArtifactKind; mimeType?: string; byteSize?: number; checksum?: string; paperId?: string; metadata?: unknown; }
export interface PaperEmbeddingDocument extends BaseDocument { paperId: string; model: string; dimensions: number; embedding: number[]; }
export type PaperNodeType = "theorem" | "lemma" | "definition" | "conjecture" | "technique" | "proof_strategy" | "mathematical_structure" | "counterexample" | "failure" | "formalization";
export interface PaperKnowledgeNodeDocument extends BaseDocument {
  type: PaperNodeType;
  title: string;
  statement: string;
  domain: string[];
  source: { paper_id: string; location: { page: number; section: string } };
  embeddings: { semantic: number[]; structural: number[]; proof: number[]; technique: number[]; domain: number[] };
  metadata: { formalized: boolean; confidence: number };
}
export interface GraphNodeDocument extends BaseDocument { entityType: GraphEntityType; entityId: string; label: string; metadata?: unknown; }
export interface GraphRelationshipDocument extends BaseDocument { fromNodeId: string; toNodeId: string; type: RelationshipType; confidence?: number; rationale?: string; metadata?: unknown; }
