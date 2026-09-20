"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import type { GraphLink, GraphNode } from "./api";
import { LAYER_COLORS, nodeColor, nodeSize } from "./palette";

// Layout geometry is purely presentational: it encodes atlas depth and research
// generation so lineage reads as branches, never mathematical distance.

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedId: string | null;
  highlightIds: Set<string>;
  reducedMotion: boolean;
  onSelect: (node: GraphNode | null) => void;
}

type FGNode = GraphNode & { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number };
type FGLink = GraphLink & { source: string | FGNode; target: string | FGNode };

function endpointId(e: string | FGNode): string {
  return typeof e === "string" ? e : e.id;
}

export default function Graph3D({ nodes, links, selectedId, highlightIds, reducedMotion, onSelect }: Props) {
  const ref = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pin z (vertical) to a semantic level: broad areas on top, problems below, ideas by generation.
  const data = useMemo(() => {
    const fgNodes: FGNode[] = nodes.map((n) => {
      const level =
        n.type === "area" ? 60 - (n.depth ?? 0) * 25 : n.type === "problem" ? 0 : n.type === "idea" ? -30 - (n.generation ?? 0) * 25 : -45 - 25 * 3;
      return { ...n, fz: level };
    });
    const ids = new Set(fgNodes.map((n) => n.id));
    const fgLinks: FGLink[] = links.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l) => ({ ...l }));
    return { nodes: fgNodes, links: fgLinks };
  }, [nodes, links]);

  useEffect(() => {
    const fg = ref.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-60);
    const linkForce = fg.d3Force("link");
    linkForce?.distance((l: FGLink) => (l.layer === "atlas" ? 40 : l.layer === "lineage" ? 22 : 16));
  }, [data]);

  useEffect(() => {
    const fg = ref.current;
    if (!fg || !selectedId) return;
    const node = data.nodes.find((n) => n.id === selectedId);
    if (!node || node.x === undefined) return;
    const dist = node.type === "idea" || node.type === "claim" ? 140 : 260;
    const r = Math.hypot(node.x, node.y ?? 0, node.z ?? 0) || 1;
    const ratio = 1 + dist / r;
    fg.cameraPosition(
      { x: node.x * ratio, y: (node.y ?? 0) * ratio, z: (node.z ?? 0) * ratio },
      { x: node.x, y: node.y ?? 0, z: node.z ?? 0 },
      reducedMotion ? 0 : 800,
    );
  }, [selectedId, data, reducedMotion]);

  const nodeObject = useCallback(
    (n: FGNode) => {
      const dim = highlightIds.size > 0 && !highlightIds.has(n.id);
      const material = new THREE.MeshLambertMaterial({
        color: nodeColor(n),
        transparent: true,
        opacity: dim ? 0.25 : n.id === selectedId ? 1 : 0.9,
        emissive: n.id === selectedId ? new THREE.Color("#ffffff") : new THREE.Color("#000000"),
        emissiveIntensity: n.id === selectedId ? 0.5 : 0,
      });
      const geometry =
        n.type === "problem"
          ? new THREE.OctahedronGeometry(nodeSize(n))
          : n.type === "claim"
            ? new THREE.BoxGeometry(nodeSize(n) * 1.6, nodeSize(n) * 1.6, nodeSize(n) * 1.6)
            : new THREE.SphereGeometry(nodeSize(n), 16, 12);
      return new THREE.Mesh(geometry, material);
    },
    [highlightIds, selectedId],
  );

  return (
    <div ref={wrapRef} className="graph-wrap">
      <ForceGraph3D<FGNode, FGLink>
        ref={ref}
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor="#0b1020"
        nodeThreeObject={nodeObject}
        nodeLabel={(n) => `<div class="tip"><b>${n.type}</b> ${escapeHtml(n.label)}${n.evidence_label ? `<br/><i>${escapeHtml(n.evidence_label)}</i>` : ""}</div>`}
        linkColor={(l) => LAYER_COLORS[l.layer]}
        linkWidth={(l) => (l.layer === "lineage" ? 1.4 : l.layer === "atlas" ? 0.6 : 1)}
        linkOpacity={0.55}
        linkCurvature={(l) => (l.layer === "association" ? 0.35 : 0)}
        linkDirectionalParticles={reducedMotion ? 0 : (l) => (l.layer === "lineage" ? 2 : 0)}
        linkDirectionalParticleWidth={1.2}
        linkDirectionalParticleColor={() => LAYER_COLORS.lineage}
        onNodeClick={(n) => onSelect(n)}
        onBackgroundClick={() => onSelect(null)}
        cooldownTicks={reducedMotion ? 0 : 120}
        warmupTicks={reducedMotion ? 150 : 0}
        enableNodeDrag={false}
        showNavInfo={false}
        linkLabel={(l) => `${l.layer}: ${l.kind} (${endpointId(l.source).slice(0, 6)} → ${endpointId(l.target).slice(0, 6)})`}
      />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
