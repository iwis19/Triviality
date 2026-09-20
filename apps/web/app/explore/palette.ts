import type { GraphNode, Layer } from "./api";

export const LAYER_COLORS: Record<Layer, string> = {
  atlas: "#7c8fa6",
  lineage: "#f2b134",
  dependency: "#4fc3f7",
  association: "#b39ddb",
};

export const EVIDENCE_COLORS: Record<string, string> = {
  lean_verified: "#2ecc71",
  lean_formalization_in_progress: "#a3e635",
  informal_proof_candidate: "#f59e0b",
  empirical_support: "#38bdf8",
  counterexample_checked: "#60a5fa",
  refuted: "#ef4444",
  lean_rejected: "#f97316",
  untested: "#9ca3af",
};

export function nodeColor(n: GraphNode): string {
  switch (n.type) {
    case "area":
      return n.depth === 0 ? "#18181b" : "#71717a";
    case "problem":
      return "#a18b66";
    case "idea":
      if (n.scheduling_status === "archived") return "#4b5563";
      return EVIDENCE_COLORS[n.evidence_status ?? "untested"] ?? "#9ca3af";
    case "claim":
      return n.formalization_status === "complete" ? "#2ecc71" : "#c084fc";
  }
}

export function nodeSize(n: GraphNode): number {
  switch (n.type) {
    case "area":
      return n.depth === 0 ? 9 : 5;
    case "problem":
      return 6;
    case "idea":
      return 3 + Math.min(3, (n.score ?? 0) * 3);
    case "claim":
      return 2.5;
  }
}
