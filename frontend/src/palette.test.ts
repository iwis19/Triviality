import { describe, expect, it } from "vitest";
import type { GraphNode } from "./api";
import { EVIDENCE_COLORS, LAYER_COLORS, nodeColor, nodeSize } from "./palette";

const base: GraphNode = { id: "n", type: "idea", label: "x", depth: 0 };

describe("nodeColor", () => {
  it("colours ideas by evidence status and never by worker self-report", () => {
    expect(nodeColor({ ...base, evidence_status: "lean_verified" })).toBe(EVIDENCE_COLORS.lean_verified);
    expect(nodeColor({ ...base, evidence_status: "informal_proof_candidate" })).toBe(EVIDENCE_COLORS.informal_proof_candidate);
    expect(nodeColor({ ...base, evidence_status: "lean_verified" })).not.toBe(
      nodeColor({ ...base, evidence_status: "informal_proof_candidate" }),
    );
  });

  it("falls back to the untested colour for unknown statuses", () => {
    expect(nodeColor({ ...base, evidence_status: "made_up" })).toBe("#9ca3af");
    expect(nodeColor({ ...base })).toBe(EVIDENCE_COLORS.untested);
  });

  it("greys out archived ideas regardless of evidence", () => {
    expect(nodeColor({ ...base, evidence_status: "lean_verified", scheduling_status: "archived" })).toBe("#4b5563");
  });

  it("distinguishes top-level areas, sub-areas and problems", () => {
    const top = nodeColor({ ...base, type: "area", depth: 0 });
    const sub = nodeColor({ ...base, type: "area", depth: 1 });
    const problem = nodeColor({ ...base, type: "problem" });
    expect(new Set([top, sub, problem]).size).toBe(3);
  });

  it("marks only fully formalized claims green", () => {
    expect(nodeColor({ ...base, type: "claim", formalization_status: "complete" })).toBe(EVIDENCE_COLORS.lean_verified);
    expect(nodeColor({ ...base, type: "claim", formalization_status: "in_progress" })).not.toBe(EVIDENCE_COLORS.lean_verified);
  });
});

describe("nodeSize", () => {
  it("scales ideas with score but caps the bonus", () => {
    expect(nodeSize({ ...base, score: 0 })).toBe(3);
    expect(nodeSize({ ...base, score: 0.5 })).toBe(4.5);
    expect(nodeSize({ ...base, score: 5 })).toBe(6);
  });

  it("orders atlas nodes by scope", () => {
    expect(nodeSize({ ...base, type: "area", depth: 0 })).toBeGreaterThan(nodeSize({ ...base, type: "problem" }));
    expect(nodeSize({ ...base, type: "problem" })).toBeGreaterThan(nodeSize({ ...base, type: "area", depth: 1 }));
  });
});

describe("layer palette", () => {
  it("has a distinct colour for every graph layer", () => {
    const colours = Object.values(LAYER_COLORS);
    expect(colours).toHaveLength(4);
    expect(new Set(colours).size).toBe(4);
  });
});
