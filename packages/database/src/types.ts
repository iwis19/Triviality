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
  leanStatement?: string;
  atlasProblemId?: string; // set when the episode targets a catalogued open problem
  stage?: string;
  progress?: number;
  summary?: string;
  error?: string;
  completedAt?: Date;
}
export interface ResearchProblemDocument extends BaseDocument { episodeId: string; title: string; statement: string; assumptions?: unknown; status: ResearchStatus; }
export interface ResearchHypothesisDocument extends BaseDocument { episodeId: string; problemId?: string; atlasProblemId?: string; statement: string; rationale: string; assumptions?: unknown; expectedConsequences?: unknown; noveltyEstimate?: number; plausibilityEstimate?: number; formalizability?: number; status: ResearchStatus; }
export interface ResearchAttemptDocument extends BaseDocument { episodeId: string; hypothesisId: string; proofStrategyId?: string; strategy: string; status: AttemptStatus; input?: unknown; proofState?: string; error?: string; startedAt?: Date; completedAt?: Date; }
export interface ResearchResultDocument extends BaseDocument { episodeId: string; hypothesisId?: string; attemptId?: string; title: string; summary: string; status: ResultStatus; evidence?: unknown; }
export interface ResearchEventDocument extends BaseDocument { episodeId: string; type: string; payload: Record<string, unknown>; }

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
  claimId?: string;      // versioned claim this check applies to
  claimVersion?: number; // verification counts only for this exact version
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

// --- Open-problem atlas + public read model (ported from MathLab) -----------
// Status dimensions stay independent: review state, evidence, formalization,
// and publication never collapse into one field.

export type AtlasProblemStatus = "unreviewed" | "reported_open" | "resolution_claimed" | "resolved" | "disputed" | "unknown";
export type ClaimFormalizationStatus = "absent" | "queued" | "in_progress" | "complete" | "failed";

export interface AtlasAreaDocument extends BaseDocument {
  slug: string;
  name: string;
  description?: string;
  parentId: string | null;
  depth: number;
}

export interface AtlasSourceAssertion {
  sourceUrl: string;
  sourceTitle: string;
  authors?: string;
  publisher?: string;
  publishedDate?: string;
  retrievedDate?: string;
  reusePolicy?: string;
  location?: string;
  assertedStatus: string; // open | resolved | disputed | unknown
  assertedAt?: string;
  reviewState: string; // unreviewed | confirmed | corrected | rejected
  notes?: string;
}

export interface AtlasStatusReview {
  reviewer?: string;
  date?: string;
  from?: string;
  to?: string;
  note?: string;
}

export interface AtlasProblemDocument extends BaseDocument {
  slug: string;
  title: string;
  statement: string;
  definitions?: string;
  assumptions?: string;
  origin: string; // literature | generated
  attribution?: string;
  status: AtlasProblemStatus | string;
  statusCheckedAt?: string;
  formalTarget?: string;
  formalTargetStatus?: string;
  coverage?: { status_reviews?: AtlasStatusReview[]; reference_formalization?: unknown; [key: string]: unknown };
  areaIds: string[];
  assertions: AtlasSourceAssertion[];
}

export interface ClaimDocument extends BaseDocument {
  statement: string;
  scope?: string;
  leanDeclaration?: string;
  contentHash: string;
  claimVersion: number;
  previousVersionId?: string;
  formalizationStatus: ClaimFormalizationStatus | string;
  episodeId?: string;
  problemId?: string; // atlas problem id or episode problem id
  hypothesisId?: string;
  sourceIdeaId?: string; // MathLab idea id for migrated claims
  sourceCampaignId?: string;
}

export interface RelationDocument extends BaseDocument {
  layer: "atlas" | "lineage" | "dependency" | "association" | string;
  kind: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  confidence?: number;
  status: string; // proposed | checked
  provenance?: Record<string, unknown>;
}

export interface PublicationDocument {
  _id: string;
  recordType: string; // problem | idea | claim | evidence | campaign
  recordId: string;
  recordVersion: string; // payload hash — a changed record publishes a new version
  publicPayload: Record<string, unknown>;
  evidenceLabel: string;
  policyVersion: string;
  eventSeq?: number;
  publishedAt: Date;
  withdrawnAt?: Date | null;
  withdrawalReason?: string;
}

export interface PublicEventDocument {
  _id: string;
  seq: number;
  type: string;
  recordType: string;
  recordId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface CounterDocument { _id: string; seq: number; }
