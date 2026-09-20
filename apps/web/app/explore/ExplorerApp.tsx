"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Search, X, Menu } from "lucide-react";
import { TrivialityLogo } from "@/components/triviality-logo";
import { TextFlippingBoard } from "@/components/ui/text-flipping-board";
import { LAYERS, publicApi, type Area, type Graph, type GraphNode, type Problem, type ProblemDetail } from "./api";
import { EVIDENCE_COLORS } from "./palette";
import "./explore.css";

const Graph3D = lazy(() => import("./Graph3D"));

export default function ExplorerApp({ intro = false }: { intro?: boolean }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [areaFilter, setAreaFilter] = useState("");
  const [problemSlug, setProblemSlug] = useState("");
  const [details, setDetails] = useState<Record<string, ProblemDetail>>({});
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [introState, setIntroState] = useState(intro ? "playing" : "done");
  const finishIntro = useCallback(() => setIntroState("holding"), []);
  const detail = details[problemSlug] ?? null;
  const closeProblem = useCallback(() => { setProblemSlug(""); setSelected(null); }, []);

  useEffect(() => {
    if (introState !== "holding") return;
    const timer = window.setTimeout(() => setIntroState("fading"), 2000);
    return () => window.clearTimeout(timer);
  }, [introState]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([publicApi.areas(), publicApi.problems(), publicApi.graph([...LAYERS])])
      .then(([a, p, g]) => { if (!cancelled) { setAreas(a); setProblems(p); setGraph(g); setError(null); } })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    if (!problemSlug) return;
    let cancelled = false;
    publicApi.problem(problemSlug)
      .then(d => { if (!cancelled) { setDetails(prev => ({ ...prev, [problemSlug]: d })); setDetailError(null); } })
      .catch((e: Error) => { if (!cancelled) setDetailError(e.message); });
    return () => { cancelled = true; };
  }, [problemSlug, refreshKey]);

  const chooseProblem = useCallback((slug: string) => {
    setDetailError(null);
    setProblemSlug(slug);
    setSelected(graph?.nodes.find(n => n.type === "problem" && n.slug === slug) ?? null);
    setMenuOpen(false);
  }, [graph]);

  const chooseArea = useCallback((slug: string) => {
    setAreaFilter(slug);
    closeProblem();
  }, [closeProblem]);

  const visibleGraph = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    if (!areaFilter) return graph;
    const matchingAreas = areas.filter(a => a.slug === areaFilter || ancestorSlugs(a, areas).includes(areaFilter));
    const areaIds = new Set(matchingAreas.map(a => a.id));
    const slugs = new Set(matchingAreas.map(a => a.slug));
    const problemIds = new Set(graph.nodes.filter(n => n.type === "problem" && n.areas?.some(s => slugs.has(s))).map(n => n.id));
    const ideaIds = new Set(graph.nodes.filter(n => n.type === "idea" && n.problem_id && problemIds.has(n.problem_id)).map(n => n.id));
    const nodes = graph.nodes.filter(n => areaIds.has(n.id) || problemIds.has(n.id) || ideaIds.has(n.id) || (n.idea_id && ideaIds.has(n.idea_id)));
    const ids = new Set(nodes.map(n => n.id));
    return { nodes, links: graph.links.filter(l => ids.has(l.source) && ids.has(l.target)) };
  }, [graph, areas, areaFilter]);

  const query = search.trim().toLowerCase();
  const filteredProblems = useMemo(() => problems.filter(p =>
    (!areaFilter || p.areas.some(a => a.slug === areaFilter || ancestorSlugsBySlug(a.slug, areas).includes(areaFilter))) &&
    (!query || `${p.title} ${p.statement}`.toLowerCase().includes(query))
  ), [problems, areas, areaFilter, query]);
  const searchHits = useMemo(() => new Set(query ? filteredProblems.map(p => p.id) : []), [query, filteredProblems]);

  const onSelect = useCallback((node: GraphNode | null) => {
    if (!node) { closeProblem(); return; }
    if (node.type === "problem" && node.slug) chooseProblem(node.slug);
    else if (node.type === "area" && node.slug) chooseArea(node.slug);
    else {
      const idea = node.type === "claim" ? graph?.nodes.find(n => n.id === node.idea_id) : node;
      const problem = problems.find(p => p.id === idea?.problem_id);
      if (problem) { setDetailError(null); setProblemSlug(problem.slug); setSelected(node); }
    }
  }, [chooseProblem, chooseArea, closeProblem, graph, problems]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeProblem(); setMenuOpen(false); }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("atlas-search")?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeProblem]);

  return (
    <div className="mlx">
      <header className="atlas-header">
        <button className="menu-toggle" aria-label="Toggle problem browser" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu size={18} /></button>
        <TrivialityLogo />
        <div className="atlas-search"><Search size={16} aria-hidden="true" /><input id="atlas-search" aria-label="Search problems" placeholder="Search mathematical problems…" value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setMenuOpen(true); }} />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</div>
        <Link aria-label="Proofs" className="proofs-link" href="/proofs/trihexagonal-shell"><BookOpen size={15} /><span>Proofs</span></Link>
        <Link className="workspace-link" href="/dashboard">Workspace <ArrowUpRight size={15} /></Link>
      </header>
      {error && <div className="error" role="alert">Could not load the atlas. <button onClick={() => setRefreshKey(k => k + 1)}>Try again</button></div>}
      <div className={`body ${problemSlug ? "has-detail" : ""}`}>
        <aside className={`left ${menuOpen ? "is-open" : ""}`} aria-label="Browse mathematics">
          <section className="area-section">
            <div className="section-heading"><h2>Mathematics</h2><span>{areas.length} areas</span></div>
            <button className={`all-areas ${areaFilter ? "" : "active"}`} onClick={() => chooseArea("")}>All of mathematics <span>{problems.length}</span></button>
            <ul className="areas">{orderAreas(areas).map(a => <li key={a.id} style={{ paddingLeft: a.depth * 12 }}><button className={areaFilter === a.slug ? "active" : ""} onClick={() => chooseArea(a.slug)}><span>{a.name}</span><small>{a.problem_count}</small></button></li>)}</ul>
          </section>
          <section className="problem-section">
            <div className="section-heading"><h2>{query ? "Search results" : "Problems"}</h2><span>{filteredProblems.length}</span></div>
            {!graph && !error && <p className="empty">Loading the atlas…</p>}
            {graph && !filteredProblems.length && <p className="empty">No problems match this search.</p>}
            <ul className="problems">{filteredProblems.map(p => <li key={p.id}><button className={problemSlug === p.slug ? "active" : ""} onClick={() => chooseProblem(p.slug)}>{p.title}<small>{p.evidence_label}</small></button></li>)}</ul>
          </section>
        </aside>
        <main aria-label="Mathematical research graph">
          <Suspense fallback={<div className="loading">Loading graph…</div>}><Graph3D nodes={visibleGraph.nodes} links={visibleGraph.links} focusNodeId={areas.find(a => a.slug === areaFilter)?.id ?? null} selectedId={selected?.id ?? null} highlightIds={searchHits} reducedMotion={reducedMotion} onSelect={onSelect} /></Suspense>
        </main>
        {problemSlug && <aside className="right" aria-label="Selected problem">
          <div className="detail-toolbar"><span>Problem details</span><button aria-label="Close problem details" onClick={closeProblem}><X size={18} /></button></div>
          {detailError ? <div role="alert" className="error">Could not load this problem. <button onClick={() => setRefreshKey(k => k + 1)}>Try again</button></div> : detail ? <>
            <Link className="solve-link" href={`/dashboard?problem=${encodeURIComponent(problemSlug)}`}>Solve this problem <ArrowUpRight size={16} /></Link>
            <DetailPanel selected={selected} detail={detail} areas={areas} onSelectIdea={id => setSelected(graph?.nodes.find(n => n.id === id) ?? null)} />
          </> : <div className="loading" role="status">Loading problem…</div>}
        </aside>}
      </div>
      {introState !== "done" && <div aria-hidden="true" className={`atlas-intro ${introState === "fading" ? "is-fading" : ""}`} onAnimationEnd={e => { if (e.target === e.currentTarget) setIntroState("done"); }}><TextFlippingBoard text="TRIVIALITY" className="!max-w-5xl !bg-transparent !p-0 !shadow-none" onComplete={finishIntro} /></div>}
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

      </div>
    );
  }
  if (selected?.type === "area") {
    const a = areas.find((x) => x.id === selected.id);
    return (
      <div className="detail">
        <h2>{a?.name}</h2>
        <MathContent>{a?.description}</MathContent>
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
        <MathContent>{idea.approach}</MathContent>
        {idea.mechanism && (
          <>
            <h4>Mechanism</h4>
            <MathContent>{idea.mechanism}</MathContent>
          </>
        )}
        {idea.next_experiment && (
          <>
            <h4>Next experiment</h4>
            <MathContent>{idea.next_experiment}</MathContent>
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
            <MathContent>{c.statement}</MathContent>
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
            <MathContent>{e.summary}</MathContent>
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
        <MathContent>{c.statement}</MathContent>
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
        <MathContent>{p.statement}</MathContent>
        {p.definitions && (
          <>
            <h4>Definitions</h4>
            <MathContent>{p.definitions}</MathContent>
          </>
        )}
        {p.assumptions && (
          <>
            <h4>Assumptions</h4>
            <MathContent>{p.assumptions}</MathContent>
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

function MathContent({ children }: { children: string | undefined }) {
  return (
    <div className="math-content">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children ?? ""}
      </ReactMarkdown>
    </div>
  );
}
