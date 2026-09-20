// Typed client for the published atlas projection. Public calls never send credentials.

const BASE = "/api/public";

export type Layer = "atlas" | "lineage" | "dependency" | "association";
export const LAYERS: Layer[] = ["atlas", "lineage", "dependency", "association"];

export interface Area {
  id: string;
  slug: string;
  name: string;
  description: string;
  parent_id: string | null;
  depth: number;
  problem_count: number;
}

export interface PublishedRecord {
  record_type: string;
  record_id: string;
  version: number;
  evidence_label: string;
  policy_version: string;
  published_at: string;
}

export interface ProblemSource {
  title: string;
  url: string;
  location: string;
  asserted_status: string;
  asserted_at: string;
  retrieved_date: string;
  review_state: string;
}

export interface StatusReview {
  reviewer: string;
  date: string;
  from: string;
  to: string;
  note: string;
}

export interface Problem extends PublishedRecord {
  id: string;
  slug: string;
  title: string;
  statement: string;
  definitions: string;
  assumptions: string;
  attribution: string;
  status: string;
  formal_target: string;
  areas: { slug: string; name: string }[];
  sources: ProblemSource[];
  status_reviews?: StatusReview[];
  status_checked_at?: string;
  origin?: string;
}

export interface Idea extends PublishedRecord {
  id: string;
  problem_id: string;
  title: string;
  approach: string;
  mechanism: string;
  next_experiment: string;
  novelty_rationale: string;
  method_tags: string[];
  generation: number;
  depth: number;
  parent_ids: string[];
  evidence_status: string;
  scheduling_status: string;
  formalization_status: string;
  score: number;
  pinned: boolean;
}

export interface Claim extends PublishedRecord {
  id: string;
  idea_id: string;
  statement: string;
  assumptions: string;
  lean_declaration: string;
  formalization_status: string;
  claim_version: number;
}

export interface Evidence extends PublishedRecord {
  id: string;
  idea_id: string;
  claim_id: string | null;
  check_type: string;
  result: string;
  summary: string;
  certified: boolean;
  verifier: string;
  verifier_version: string;
  assumptions: string[];
  axioms: string[];
  reasons: string[];
}

export interface ProblemDetail {
  problem: Problem;
  campaigns: PublishedRecord[];
  ideas: Idea[];
  claims: Claim[];
  evidence: Evidence[];
}

export interface GraphNode {
  id: string;
  type: "area" | "problem" | "idea" | "claim";
  label: string;
  slug?: string;
  depth?: number;
  parent_id?: string | null;
  status?: string;
  evidence_label?: string;
  evidence_status?: string;
  scheduling_status?: string;
  formalization_status?: string;
  generation?: number;
  problem_id?: string;
  idea_id?: string;
  areas?: string[];
  score?: number;
  method_tags?: string[];
}

export interface GraphLink {
  source: string;
  target: string;
  layer: Layer;
  kind: string;
  status?: string;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
  layers: string[];
}

export interface PublicEvent {
  id: number;
  type: string;
  record_type: string;
  record_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${await r.text()}`);
  return (await r.json()) as T;
}

export const publicApi = {
  areas: () => getJson<Area[]>(`${BASE}/areas`),
  problems: (area?: string) =>
    getJson<Problem[]>(`${BASE}/problems${area ? `?area=${encodeURIComponent(area)}` : ""}`),
  problem: (slug: string) => getJson<ProblemDetail>(`${BASE}/problems/${encodeURIComponent(slug)}`),
  graph: (layers: Layer[], problem?: string) => {
    const q = new URLSearchParams({ layers: layers.join(",") });
    if (problem) q.set("problem", problem);
    return getJson<Graph>(`${BASE}/graph?${q}`);
  },
  events: (sinceId = 0, limit = 1000) =>
    getJson<PublicEvent[]>(`${BASE}/events?since_id=${sinceId}&limit=${limit}`),
  labels: () =>
    getJson<{ evidence: Record<string, string>; problem_status: Record<string, string> }>(`${BASE}/labels`),
};
