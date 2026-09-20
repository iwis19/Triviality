"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import type { GraphLink, GraphNode } from "./api";
import { trihexagonalDemo } from "@/lib/trihexagonal-demo";
import { LAYER_COLORS, nodeColor, nodeSize } from "./palette";

// Positions visualize relationships, not mathematical distance.
// Evidence labels remain authoritative.

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  focusNodeId: string | null;
  selectedId: string | null;
  highlightIds: Set<string>;
  reducedMotion: boolean;
  entranceReady: boolean;
  onSelect: (node: GraphNode | null) => void;
}

type FGNode = GraphNode & { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number };
type FGLink = GraphLink & { source: string | FGNode; target: string | FGNode };

function endpointId(e: string | FGNode): string {
  return typeof e === "string" ? e : e.id;
}

export default function Graph3D({ nodes, links, focusNodeId, selectedId, highlightIds, reducedMotion, entranceReady, onSelect }: Props) {
  const ref = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cameraFrame = useRef<number | null>(null);
  const initialCameraState = useRef<"idle" | "running" | "done">("idle");
  const entranceWasReady = useRef(entranceReady);
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

  // Seed a repeatable volume rather than locking every problem to one plane.
  // All three axes remain free for the relationship forces to form clusters.
  const data = useMemo(() => {
    const radius = Math.max(180, Math.cbrt(nodes.length) * 28);
    const fgNodes: FGNode[] = nodes.map((n) => {
      const azimuth = hashUnit(`${n.id}:angle`) * Math.PI * 2;
      const cosPolar = hashUnit(`${n.id}:height`) * 2 - 1;
      const sinPolar = Math.sqrt(1 - cosPolar * cosPolar);
      const r = radius * Math.cbrt(0.08 + 0.92 * hashUnit(`${n.id}:radius`));
      return { ...n, x: r * sinPolar * Math.cos(azimuth), y: r * sinPolar * Math.sin(azimuth), z: r * cosPolar };
    });
    const ids = new Set(fgNodes.map((n) => n.id));
    const fgLinks: FGLink[] = links.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l) => ({ ...l }));

    if (focusNodeId && ids.has(focusNodeId)) {
      const adjacency = new Map(fgNodes.map((n) => [n.id, [] as string[]]));
      for (const link of fgLinks) {
        const source = endpointId(link.source);
        const target = endpointId(link.target);
        adjacency.get(source)?.push(target);
        adjacency.get(target)?.push(source);
      }

      const distance = new Map<string, number>([[focusNodeId, 0]]);
      const queue = [focusNodeId];
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i];
        const nextDistance = (distance.get(id) ?? 0) + 1;
        for (const neighbor of adjacency.get(id) ?? []) {
          if (distance.has(neighbor)) continue;
          distance.set(neighbor, nextDistance);
          queue.push(neighbor);
        }
      }

      const maxDistance = Math.max(0, ...distance.values());
      for (const node of fgNodes) {
        if (!distance.has(node.id)) distance.set(node.id, maxDistance + 1);
      }

      const rings = new Map<number, FGNode[]>();
      for (const node of fgNodes) {
        const ring = distance.get(node.id) ?? 0;
        const group = rings.get(ring) ?? [];
        group.push(node);
        rings.set(ring, group);
      }

      for (const [ring, ringNodes] of rings) {
        ringNodes.sort((a, b) => a.label.localeCompare(b.label));
        const radius = ring === 0 ? 0 : Math.max(ring * 100, ringNodes.length * 8);
        ringNodes.forEach((node, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / ringNodes.length;
          node.fx = radius * Math.cos(angle);
          node.fy = radius * Math.sin(angle);
          node.fz = 0;
          node.x = node.fx;
          node.y = node.fy;
          node.z = 0;
        });
      }
    }

    return { nodes: fgNodes, links: fgLinks };
  }, [nodes, links, focusNodeId]);

  useEffect(() => {
    const fg = ref.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-100);
    const linkForce = fg.d3Force("link");
    linkForce?.distance((l: FGLink) => (l.layer === "atlas" ? 65 : l.layer === "lineage" ? 40 : 32));
  }, [data]);

  const stopCamera = useCallback(() => {
    if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current = null;
  }, []);

  const stopInitialCamera = useCallback(() => {
    initialCameraState.current = "done";
    stopCamera();
  }, [stopCamera]);

  const moveCamera = useCallback((position: THREE.Vector3, target: THREE.Vector3, viaPosition?: THREE.Vector3, onComplete?: () => void) => {
    const fg = ref.current;
    if (!fg) return;
    stopCamera();
    const startPosition = fg.camera().position.clone();
    const startTarget = (fg.controls() as { target: THREE.Vector3 }).target.clone();
    // Keep the requested startup zoom; reduce incidental selection movements.
    if (reducedMotion && !viaPosition) { fg.cameraPosition(position, target, 0); onComplete?.(); return; }
    const started = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - started) / (viaPosition ? 2400 : 1100));
      // Move the camera and its target together, with gentle acceleration and
      // deceleration. Interrupted moves start from the current visible frame.
      if (viaPosition) {
        const pullbackProgress = Math.min(1, t / 0.45);
        const pullbackEase = smootherStep(pullbackProgress);
        const zoomProgress = Math.max(0, (t - 0.55) / 0.45);
        const zoomEase = smootherStep(zoomProgress);
        const startOffset = startPosition.clone().sub(startTarget);
        const viaOffset = viaPosition.clone().sub(target);
        const finalOffset = position.clone().sub(target);
        // Change only the distance from the target during the entrance.
        const distance = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(startOffset.length(), viaOffset.length(), pullbackEase),
          finalOffset.length(), zoomEase,
        );
        const direction = startOffset.normalize();
        const currentTarget = startTarget;
        fg.cameraPosition(
          currentTarget.clone().addScaledVector(direction, distance),
          currentTarget, 0,
        );
      } else {
        const eased = smootherStep(t);
        fg.cameraPosition(
          startPosition.clone().lerp(position, eased),
          startTarget.clone().lerp(target, eased), 0,
        );
      }
      cameraFrame.current = t < 1 ? requestAnimationFrame(frame) : null;
      if (t === 1) onComplete?.();
    };
    cameraFrame.current = requestAnimationFrame(frame);
  }, [reducedMotion, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const frameRadialLayout = useCallback(() => {
    const fg = ref.current;
    if (!fg || !focusNodeId) return;
    const radius = Math.max(
      40,
      ...data.nodes.map((node) => Math.hypot(node.fx ?? 0, node.fy ?? 0) + nodeSize(node)),
    );
    const camera = fg.camera() as THREE.PerspectiveCamera;
    const verticalFit = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const limitingFit = Math.min(verticalFit, verticalFit * (size.width / size.height));
    const fill = Math.min(0.82, 0.54 + Math.log2(Math.max(2, data.nodes.length)) * 0.04);
    const distance = Math.max(120, radius / (limitingFit * fill));
    moveCamera(new THREE.Vector3(0, 0, distance), new THREE.Vector3(0, 0, 0));
  }, [data, focusNodeId, size, moveCamera]);

  const focusSelection = useCallback(() => {
    const fg = ref.current;
    if (!fg || !selectedId) return;
    const node = data.nodes.find((n) => n.id === selectedId);
    if (!node || node.x === undefined) return;
    const target = new THREE.Vector3(node.x, node.y ?? 0, node.z ?? 0);
    const camera = fg.camera() as THREE.PerspectiveCamera;
    const controls = fg.controls() as { target: THREE.Vector3 };
    // Preserve the user's viewing direction and frame against the actual canvas,
    // including its new size after the details panel opens.
    const direction = camera.position.clone().sub(controls.target).normalize();
    if (!direction.lengthSq()) direction.set(0, 0, 1);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const limitingFov = Math.atan(Math.tan(halfFov) * Math.min(1, size.width / size.height));
    const contextRadius = node.type === "problem" ? 65 : 45;
    const distance = contextRadius / Math.sin(limitingFov);
    const position = target.clone().addScaledVector(direction, distance);
    moveCamera(position, target);
  }, [selectedId, data, size, moveCamera]);

  useEffect(() => {
    if (!selectedId) return;
    stopInitialCamera();
    // Let the sidebar resize finish before starting one continuous move.
    const timer = window.setTimeout(focusSelection, 80);
    return () => { window.clearTimeout(timer); stopCamera(); };
  }, [selectedId, focusSelection, stopInitialCamera, stopCamera]);

  useEffect(() => {
    if (!focusNodeId || selectedId) return;
    stopInitialCamera();
    const timer = window.setTimeout(frameRadialLayout, 80);
    return () => { window.clearTimeout(timer); stopCamera(); };
  }, [focusNodeId, selectedId, frameRadialLayout, stopInitialCamera, stopCamera]);

  const placeDemoAtTop = useCallback(() => {
    const fg = ref.current;
    const node = data.nodes.find(node => node.id === trihexagonalDemo.id);
    if (!fg || !node || focusNodeId || selectedId) return;
    const camera = fg.camera();
    camera.updateMatrixWorld();
    const target = (fg.controls() as { target: THREE.Vector3 }).target;
    // Use the final camera's screen-up direction, so rotation cannot hide the node.
    const depth = target.clone().project(camera).z;
    const position = new THREE.Vector3(0, 0.86, depth).unproject(camera);
    node.x = node.fx = position.x;
    node.y = node.fy = position.y;
    node.z = node.fz = position.z;
    fg.refresh();
  }, [data, focusNodeId, selectedId]);

  const settleCamera = useCallback(() => {
    const fg = ref.current;
    if (!fg || !entranceReady || data.nodes.length === 0 || initialCameraState.current !== "idle" || selectedId || focusNodeId) return;
    initialCameraState.current = "running";
    const startPosition = fg.camera().position.clone();
    const startTarget = (fg.controls() as { target: THREE.Vector3 }).target.clone();
    const target = startTarget.clone();
    const startOffset = startPosition.clone().sub(target);
    // Use the opening view, not zoomToFit's render-dependent bounding box.
    // The intro always pulls back by 55%, then returns to its starting scale.
    const pulledBackPosition = target.clone().addScaledVector(startOffset, 1.55);
    moveCamera(startPosition, target, pulledBackPosition, () => { initialCameraState.current = "done"; placeDemoAtTop(); });
  }, [entranceReady, data.nodes.length, selectedId, focusNodeId, moveCamera, placeDemoAtTop]);

  useEffect(() => {
    if (!entranceReady) {
      entranceWasReady.current = false;
      return;
    }
    if (!entranceWasReady.current) {
      entranceWasReady.current = true;
      initialCameraState.current = "idle";
    }
    settleCamera();
  }, [entranceReady, settleCamera]);

  // Reuse geometry/materials, and update only appearance on selection/search.
  // Previously every click rebuilt all 1,800+ node meshes and their materials.
  const resources = useMemo(() => ({
    geometries: {
      problem: new THREE.OctahedronGeometry(1),
      claim: new THREE.BoxGeometry(1.6, 1.6, 1.6),
      area: new THREE.SphereGeometry(1, 8, 6),
      idea: new THREE.SphereGeometry(1, 8, 6),
    },
    materials: new Map<string, THREE.MeshBasicMaterial>(),
    meshes: new Map<string, THREE.Mesh>(),
  }), []);

  const materialFor = useCallback((color: string, dim: boolean) => {
    const key = `${color}:${dim}`;
    let material = resources.materials.get(key);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, transparent: dim, opacity: dim ? 0.2 : 1 });
      resources.materials.set(key, material);
    }
    return material;
  }, [resources]);

  const nodeObject = useCallback((n: FGNode) => {
    const mesh = new THREE.Mesh(resources.geometries[n.id === trihexagonalDemo.id ? "area" : n.type], materialFor(nodeColor(n), false));
    mesh.scale.setScalar(nodeSize(n) * (n.id === trihexagonalDemo.id ? 3 : 1));
    resources.meshes.set(n.id, mesh);
    return mesh;
  }, [resources, materialFor]);

  useEffect(() => {
    const ids = new Set(data.nodes.map(n => n.id));
    for (const id of resources.meshes.keys()) if (!ids.has(id)) resources.meshes.delete(id);
    for (const n of data.nodes) {
      const mesh = resources.meshes.get(n.id);
      if (!mesh) continue;
      mesh.material = materialFor(nodeColor(n), highlightIds.size > 0 && !highlightIds.has(n.id) && n.id !== selectedId);
      mesh.scale.setScalar(nodeSize(n) * (n.id === trihexagonalDemo.id ? 3 : 1) * (n.id === selectedId ? 1.5 : 1));
    }
  }, [data, highlightIds, selectedId, resources, materialFor]);

  useEffect(() => {
    // Bound high-DPI fill cost; the graph is an overview, not a text surface.
    ref.current?.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    return () => {
      Object.values(resources.geometries).forEach(geometry => geometry.dispose());
      resources.materials.forEach(material => material.dispose());
      resources.materials.clear();
      resources.meshes.clear();
    };
  }, [resources]);

  return (
    <div ref={wrapRef} className="graph-wrap" onPointerDown={stopInitialCamera} onWheel={stopInitialCamera}>
      <ForceGraph3D<FGNode, FGLink>
        ref={ref}
        width={size.width}
        height={size.height}
        graphData={data}
        numDimensions={3}
        backgroundColor="#fafaf8"
        nodeThreeObject={nodeObject}
        nodeLabel={(n) => `<div class="tip"><b>${n.type}</b> ${escapeHtml(n.label)}${n.evidence_label ? `<br/><i>${escapeHtml(n.evidence_label)}</i>` : ""}</div>`}
        linkColor={(l) => LAYER_COLORS[l.layer]}
        linkWidth={0}
        linkOpacity={0.22}
        linkCurvature={0}
        linkDirectionalParticles={0}
        onNodeClick={(n) => onSelect(n)}
        onBackgroundClick={() => onSelect(null)}
        cooldownTicks={reducedMotion || selectedId ? 0 : 90}
        warmupTicks={reducedMotion ? 100 : 30}
        onEngineStop={settleCamera}
        enableNodeDrag={false}
        showNavInfo={false}
        linkLabel=""
        linkHoverPrecision={0}
      />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

// Stable, inexpensive pseudo-random values keep reloaded layouts consistent.
function hashUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0) / 4294967296;
}

function smootherStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}
