"use client";

import Link from "next/link";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import {
  LAYERS,
  publicApi,
  type Area,
  type Graph,
  type GraphNode,
  type Layer,
  type Problem,
  type ProblemDetail,
  type PublicEvent,
} from "./api";
import { EVIDENCE_COLORS, LAYER_COLORS, nodeColor } from "./palette";
import "./explore.css";

const Graph3D = lazy(() => import("./Graph3D"));

type View = "3d" | "list";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export default function ExplorerApp() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [layers, setLayers] = useState<Layer[]>([...LAYERS]);
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [problemSlug, setProblemSlug] = useState<string>("");
  const [detailBySlug, setDetailBySlug] = useState<Record<string, ProblemDetail>>({});
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("3d");
  const [replayCursor, setReplayCursor] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const systemReduced = usePrefersReducedMotion();
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const reducedMotion = motionOverride ?? systemReduced;

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    Promise.all([publicApi.areas(), publicApi.problems(), publicApi.events(0, 1000)])
      .then(([a, p, e]) => {
        setAreas(a);
        setProblems(p);
        setEvents(e);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [refreshKey]);

  useEffect(() => {
    publicApi
      .graph(layers, problemSlug || undefined)
      .then(setGraph)
      .catch((e: Error) => setError(e.message));
  }, [layers, problemSlug, refreshKey]);

  useEffect(() => {
    if (!problemSlug) return;
    let cancelled = false;
    publicApi
      .problem(problemSlug)
      .then((d) => {
        if (!cancelled) setDetailBySlug((m) => ({ ...m, [problemSlug]: d }));
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [problemSlug, refreshKey]);

  const detail = problemSlug ? detailBySlug[problemSlug] ?? null : null;

  // Replay: only records published at or before the cursor event are shown.
  const publishedBefore = useMemo(() => {
    if (replayCursor === null) return null;
    const ids = new Set<string>();
    for (const e of events) {
      if (e.id <= replayCursor && e.type === "publication.created") ids.add(e.record_id);
    }
    return ids;
  }, [events, replayCursor]);

  const visibleGraph = useMemo(() => {
    if (!graph) return { nodes: [] as GraphNode[], links: [] as Graph["links"] };
    let nodes = graph.nodes;
    if (areaFilter) {
      const areaIds = new Set(areas.filter((a) => a.slug === areaFilter || ancestorSlugs(a, areas).includes(areaFilter)).map((a) => a.id));
      const areaSlugs = new Set(areas.filter((a) => areaIds.has(a.id)).map((a) => a.slug));
      const problemIds = new Set(nodes.filter((n) => n.type === "problem" && n.areas?.some((s) => areaSlugs.has(s))).map((n) => n.id));
      const ideaIds = new Set(nodes.filter((n) => n.type === "idea" && n.problem_id && problemIds.has(n.problem_id)).map((n) => n.id));
      nodes = nodes.filter(
        (n) =>
          (n.type === "area" && areaIds.has(n.id)) ||
          (n.type === "problem" && problemIds.has(n.id)) ||
          (n.type === "idea" && ideaIds.has(n.id)) ||
          (n.type === "claim" && n.idea_id && ideaIds.has(n.idea_id)),
      );
    }
    if (!showArchived) nodes = nodes.filter((n) => n.scheduling_status !== "archived");
    if (publishedBefore) nodes = nodes.filter((n) => n.type === "area" || publishedBefore.has(n.id));
    const ids = new Set(nodes.map((n) => n.id));
    const links = graph.links.filter((l) => ids.has(l.source) && ids.has(l.target));
    return { nodes, links };
  }, [graph, areaFilter, areas, showArchived, publishedBefore]);

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(visibleGraph.nodes.filter((n) => n.label.toLowerCase().includes(q) || n.method_tags?.some((t) => t.includes(q))).map((n) => n.id));
  }, [search, visibleGraph]);

  const onSelect = useCallback(
    (node: GraphNode | null) => {
      setSelected(node);
      if (node?.type === "problem" && node.slug) setProblemSlug(node.slug);
      if (node?.type === "area" && node.slug) setAreaFilter(node.slug);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        setSelected(null);
        setProblemSlug("");
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("search")?.focus();
      } else if (e.key === "l") setView((v) => (v === "3d" ? "list" : "3d"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ graph: visibleGraph, detail, exported_at: new Date().toISOString() }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `triviality-${problemSlug || areaFilter || "atlas"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxEvent = events.length ? events[events.length - 1].id : 0;

  return (
    <div className="mlx">
      <header>
        <h1>Triviality explorer</h1>
        <span className="tag">atlas of reported open problems · research lineage · evidence labels</span>
        <input
          id="search"
          placeholder="Search nodes ( / )"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search graph nodes"
        />
        <button onClick={() => setView(view === "3d" ? "list" : "3d")} aria-pressed={view === "list"}>
          {view === "3d" ? "List view (l)" : "3D view (l)"}
        </button>
        <label>
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setMotionOverride(e.target.checked)} /> reduced motion
        </label>
        <button onClick={exportJson}>Export JSON</button>
        <Link className="navlink" href="/dashboard">
          Workspace →
        </Link>
      </header>
      {error && (
        <div className="error" role="alert">
          {error} <button onClick={refresh}>retry</button>
        </div>
      )}
      <div className="body">
        <aside className="left">
          <section>
            <h2>Layers</h2>
            {LAYERS.map((l) => (
              <label key={l} className="layer">
                <input
                  type="checkbox"
                  checked={layers.includes(l)}
                  onChange={(e) => setLayers(e.target.checked ? [...layers, l] : layers.filter((x) => x !== l))}
                />
                <span className="swatch" style={{ background: LAYER_COLORS[l] }} /> {l}
              </label>
            ))}
            <label className="layer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> show archived branches
            </label>
          </section>
          <section>
            <h2>Areas</h2>
            <button className={areaFilter ? "" : "active"} onClick={() => { setAreaFilter(""); setProblemSlug(""); }}>
              All of mathematics
            </button>
            <ul className="areas">
              {orderAreas(areas).map((a) => (
                <li key={a.id} style={{ paddingLeft: a.depth * 12 }}>
                  <button className={areaFilter === a.slug ? "active" : ""} onClick={() => { setAreaFilter(a.slug); setProblemSlug(""); }}>
                    {a.name} <small>{a.problem_count}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Problems {areaFilter && <small>in {areaFilter}</small>}</h2>
            <ul className="problems">
              {problems
                .filter((p) => !areaFilter || p.areas.some((a) => a.slug === areaFilter || ancestorSlugsBySlug(a.slug, areas).includes(areaFilter)))
                .map((p) => (
                  <li key={p.id}>
                    <button className={problemSlug === p.slug ? "active" : ""} onClick={() => setProblemSlug(p.slug)}>
                      {p.title}
                    </button>
                    <small>{p.evidence_label}</small>
                  </li>
                ))}
            </ul>
          </section>
          <section>
            <h2>Legend</h2>
            {Object.entries(EVIDENCE_COLORS).map(([k, c]) => (
              <div key={k} className="legend">
                <span className="swatch" style={{ background: c }} /> {k.replace(/_/g, " ")}
              </div>
            ))}
          </section>
        </aside>

        <main>
          {view === "3d" ? (
            <Suspense fallback={<div className="loading">Loading 3D explorer…</div>}>
              <Graph3D
                nodes={visibleGraph.nodes}
                links={visibleGraph.links}
                selectedId={selected?.id ?? null}
                highlightIds={searchHits}
                reducedMotion={reducedMotion}
                onSelect={onSelect}
              />
            </Suspense>
          ) : (
            <ListView nodes={visibleGraph.nodes} links={visibleGraph.links} selectedId={selected?.id ?? null} onSelect={onSelect} highlight={searchHits} />
          )}
          <div className="replay">
            <label>
              Replay publication timeline
              <input
                type="range"
                min={0}
                max={maxEvent}
                value={replayCursor ?? maxEvent}
                onChange={(e) => setReplayCursor(Number(e.target.value) >= maxEvent ? null : Number(e.target.value))}
                aria-label="Replay public events"
              />
            </label>
            <span>
              {replayCursor === null ? "live" : `event #${replayCursor}`} · {visibleGraph.nodes.length} nodes / {visibleGraph.links.length} links
            </span>
            {replayCursor !== null && <button onClick={() => setReplayCursor(null)}>back to live</button>}
          </div>
        </main>

        <aside className="right">
          <DetailPanel selected={selected} detail={detail} areas={areas} onSelectIdea={(id) => setSelected(visibleGraph.nodes.find((n) => n.id === id) ?? null)} />
        </aside>
      </div>
    </div>
  );
}

function orderAreas(areas: Area[]): Area[] {
  const out: Area[] = [];
  const visit = (parentId: string | null) => {
    for (const a of areas.filter((x) => x.parent_id === parentId).sort((x, y) => x.name.localeCompare(y.name))) {
      out.push(a);
      visit(a.id);
    }
  };
  visit(null);
  return out;
}

function ancestorSlugs(a: Area, areas: Area[]): string[] {
  const out: string[] = [];
  let cur: Area | undefined = a;
  while (cur?.parent_id) {
    cur = areas.find((x) => x.id === cur!.parent_id);
    if (cur) out.push(cur.slug);
  }
  return out;
}

function ancestorSlugsBySlug(slug: string, areas: Area[]): string[] {
  const a = areas.find((x) => x.slug === slug);
  return a ? ancestorSlugs(a, areas) : [];
}

function ListView({
  nodes,
  links,
  selectedId,
  onSelect,
  highlight,
}: {
  nodes: GraphNode[];
  links: Graph["links"];
  selectedId: string | null;
  onSelect: (n: GraphNode) => void;
  highlight: Set<string>;
}) {
  const byType = (t: GraphNode["type"]) => nodes.filter((n) => n.type === t);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const l of links) {
      d.set(l.source, (d.get(l.source) ?? 0) + 1);
      d.set(l.target, (d.get(l.target) ?? 0) + 1);
    }
    return d;
  }, [links]);
  return (
    <div className="list" role="list">
      {(["area", "problem", "idea", "claim"] as const).map((t) => (
        <section key={t}>
          <h3>
            {t}s <small>{byType(t).length}</small>
          </h3>
          {byType(t).map((n) => (
            <button
              key={n.id}
              role="listitem"
              className={`row ${n.id === selectedId ? "active" : ""} ${highlight.size && !highlight.has(n.id) ? "dim" : ""}`}
              onClick={() => onSelect(n)}
            >
              <span className="swatch" style={{ background: nodeColor(n) }} />
              <span className="grow">{n.label}</span>
              {n.generation !== undefined && <small>gen {n.generation}</small>}
              {n.evidence_label && <small>{n.evidence_label}</small>}
              <small>{degree.get(n.id) ?? 0} links</small>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function DetailPanel({
  selected,
  detail,
  areas,
  onSelectIdea,
}: {
  selected: GraphNode | null;
  detail: ProblemDetail | null;
  areas: Area[];
  onSelectIdea: (id: string) => void;
}) {
  if (!selected && !detail) {
    return (
      <div className="detail">
        <h2>Explore</h2>
        <p>
          Click an area to narrow the atlas, a problem to load its research tree, or an idea to inspect its evidence. Everything here is the
          automatically published projection; labels state exactly what has been checked.
        </p>
        <p>
          <b>Lean verified</b> means an independent checker accepted the exact approved target with no <code>sorry</code> and only allowed axioms.
          Every other label is weaker and says so.
        </p>
        <p>Keys: <kbd>/</kbd> search · <kbd>l</kbd> list/3D · <kbd>Esc</kbd> clear.</p>
      </div>
    );
  }
  if (selected?.type === "area") {
    const a = areas.find((x) => x.id === selected.id);
    return (
      <div className="detail">
        <h2>{a?.name}</h2>
        <p>{a?.description}</p>
        <p>
          <small>{a?.problem_count} problems classified here</small>
        </p>
      </div>
    );
  }
  if (selected?.type === "idea" && detail) {
    const idea = detail.ideas.find((i) => i.id === selected.id);
    const claims = detail.claims.filter((c) => c.idea_id === selected.id);
    const evidence = detail.evidence.filter((e) => e.idea_id === selected.id);
    if (!idea) return <div className="detail">Idea not in current problem view.</div>;
    return (
      <div className="detail">
        <span className="label" style={{ background: EVIDENCE_COLORS[idea.evidence_status] ?? "#9ca3af" }}>
          {idea.evidence_label}
        </span>
        <h2>{idea.title}</h2>
        <p>
          <small>
            generation {idea.generation} · depth {idea.depth} · {idea.scheduling_status} · score {idea.score}
            {idea.pinned ? " · pinned" : ""}
          </small>
        </p>
        <h4>Approach</h4>
        <p>{idea.approach}</p>
        {idea.mechanism && (
          <>
            <h4>Mechanism</h4>
            <p>{idea.mechanism}</p>
          </>
        )}
        {idea.next_experiment && (
          <>
            <h4>Next experiment</h4>
            <p>{idea.next_experiment}</p>
          </>
        )}
        {idea.parent_ids.length > 0 && (
          <p>
            Parents:{" "}
            {idea.parent_ids.map((p) => (
              <button key={p} className="link" onClick={() => onSelectIdea(p)}>
                {detail.ideas.find((i) => i.id === p)?.title ?? p.slice(0, 8)}
              </button>
            ))}
          </p>
        )}
        <h4>Claims ({claims.length})</h4>
        {claims.map((c) => (
          <div key={c.id} className="card">
            <span className="label small">{c.evidence_label}</span>
            <p>{c.statement}</p>
            {c.lean_declaration && <pre>{c.lean_declaration}</pre>}
            <small>
              claim v{c.claim_version} · formalization {c.formalization_status}
            </small>
          </div>
        ))}
        <h4>Evidence ({evidence.length})</h4>
        {evidence.map((e) => (
          <div key={e.id} className={`card ${e.certified ? "certified" : ""}`}>
            <span className="label small">{e.evidence_label}</span>
            <p>
              <b>{e.check_type}</b> → {e.result} {e.certified ? "(independently certified)" : "(worker-reported)"}
            </p>
            <p>{e.summary}</p>
            {e.verifier && (
              <small>
                verifier {e.verifier} {e.verifier_version}
              </small>
            )}
            {e.reasons?.length > 0 && (
              <ul>
                {e.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (selected?.type === "claim" && detail) {
    const c = detail.claims.find((x) => x.id === selected.id);
    if (!c) return <div className="detail">Claim not in view.</div>;
    return (
      <div className="detail">
        <span className="label">{c.evidence_label}</span>
        <h2>Claim</h2>
        <p>{c.statement}</p>
        {c.lean_declaration && <pre>{c.lean_declaration}</pre>}
        <p>
          <small>
            version {c.claim_version} · {c.formalization_status} · a changed statement is a new claim version and never inherits verification
          </small>
        </p>
        <button className="link" onClick={() => onSelectIdea(c.idea_id)}>
          ← parent idea
        </button>
      </div>
    );
  }
  if (detail) {
    const p = detail.problem;
    const byGen = new Map<number, number>();
    for (const i of detail.ideas) byGen.set(i.generation, (byGen.get(i.generation) ?? 0) + 1);
    return (
      <div className="detail">
        <span className="label">{p.evidence_label}</span>
        <h2>{p.title}</h2>
        <p>{p.statement}</p>
        {p.definitions && (
          <>
            <h4>Definitions</h4>
            <p>{p.definitions}</p>
          </>
        )}
        {p.assumptions && (
          <>
            <h4>Assumptions</h4>
            <p>{p.assumptions}</p>
          </>
        )}
        {p.formal_target && (
          <>
            <h4>Formal target</h4>
            <pre>{p.formal_target}</pre>
          </>
        )}
        <p>
          <small>Areas: {p.areas.map((a) => a.name).join(", ")}</small>
        </p>
        <h4>Sources ({p.sources.length})</h4>
        <ul className="sources">
          {p.sources.map((s, i) => (
            <li key={i}>
              <a href={s.url} target="_blank" rel="noreferrer noopener">
                {s.title}
              </a>
              <br />
              <small>
                asserts <b>{s.asserted_status}</b>
                {s.asserted_at ? ` (${s.asserted_at})` : ""} · retrieved {s.retrieved_date} · review: {s.review_state}
                {s.location ? ` · ${s.location}` : ""}
              </small>
            </li>
          ))}
        </ul>
        {p.status_reviews && p.status_reviews.length > 0 && (
          <>
            <h4>Status review history</h4>
            <ul className="sources">
              {p.status_reviews.map((r, i) => (
                <li key={i}>
                  <small>
                    {r.date} · {r.reviewer}: {r.from} → <b>{r.to}</b>
                    {r.note ? ` — ${r.note}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          </>
        )}
        <h4>Research tree</h4>
        <p>
          <small>
            {detail.ideas.length} ideas across {byGen.size} generation{byGen.size === 1 ? "" : "s"} · {detail.claims.length} claims ·{" "}
            {detail.evidence.length} evidence records · {detail.campaigns.length} campaigns
          </small>
        </p>
        {[...byGen.keys()]
          .sort((a, b) => a - b)
          .map((g) => (
            <div key={g}>
              <h5>Generation {g}</h5>
              {detail.ideas
                .filter((i) => i.generation === g)
                .sort((a, b) => b.score - a.score)
                .map((i) => (
                  <button key={i.id} className="row" onClick={() => onSelectIdea(i.id)}>
                    <span className="swatch" style={{ background: EVIDENCE_COLORS[i.evidence_status] ?? "#9ca3af" }} />
                    <span className="grow">{i.title}</span>
                    <small>{i.scheduling_status}</small>
                  </button>
                ))}
            </div>
          ))}
      </div>
    );
  }
  return null;
}
