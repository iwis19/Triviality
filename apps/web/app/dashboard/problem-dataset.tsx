"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { publicApi, type Problem } from "../explore/api";

const PAGE_SIZE = 12;
const fieldClass = "h-11 rounded-xl border border-black/12 bg-white px-3 text-sm outline-none focus:border-black/40";

export function ProblemDataset() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    publicApi.problems().then((data) => {
      if (!cancelled) setProblems(data);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [attempt]);

  const areas = useMemo(() => Array.from(new Map(problems.flatMap((problem) => problem.areas.map((item) => [item.slug, item.name] as const)))).sort((a, b) => a[1].localeCompare(b[1])), [problems]);
  const statuses = useMemo(() => [...new Set(problems.map((problem) => problem.status))].sort(), [problems]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return problems.filter((problem) =>
      (!area || problem.areas.some((item) => item.slug === area)) &&
      (!status || problem.status === status) &&
      (!search || `${problem.title} ${problem.statement} ${problem.attribution} ${problem.areas.map((item) => item.name).join(" ")}`.toLowerCase().includes(search)),
    );
  }, [problems, query, area, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section id="problems" aria-labelledby="problems-heading" className="mt-12 border-t border-black/10 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="problems-heading" className="text-xl font-semibold tracking-[-0.04em]">Problem dataset</h2>
        </div>
        {!loading && !error && <span className="text-sm text-black/50">{problems.length.toLocaleString()} problems</span>}
      </div>
      <div className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_200px]">
        <input aria-label="Search problems" placeholder="Search problems or statements…" className={fieldClass} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
        <select aria-label="Filter problems by area" className={fieldClass} value={area} onChange={(event) => { setArea(event.target.value); setPage(0); }}>
          <option value="">All areas</option>
          {areas.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
        </select>
        <select aria-label="Filter problems by status" className={fieldClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
          <option value="">All statuses</option>
          {statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      {loading ? <p role="status" className="py-10 text-center text-sm text-black/50">Loading problem dataset…</p> : error ? (
        <div role="alert" className="rounded-xl border border-red-900/15 bg-red-50 p-4 text-sm text-red-900">
          Could not load the problem dataset.
          <button className="ml-3 underline" onClick={() => { setError(false); setLoading(true); setAttempt((value) => value + 1); }}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-6 py-12 text-center text-sm text-black/50">{problems.length ? "No problems match your filters." : "No published problems are available yet."}</p>
      ) : (
        <>
          <div className="space-y-3">
            {visible.map((problem) => (
              <details key={problem.id} className="group rounded-xl border border-black/10 bg-white">
                <summary className="cursor-pointer px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2">
                  <span className="font-medium">{problem.title}</span>
                  <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-4 text-xs text-black/50">
                    <span>{problem.areas.map((item) => item.name).join(" · ") || "Mathematics"}</span>
                    <span>{problem.evidence_label || problem.status.replaceAll("_", " ")}</span>
                  </span>
                </summary>
                <div className="border-t border-black/10 px-5 py-5">
                  <div className="space-y-3 overflow-x-auto text-sm leading-7 [overflow-wrap:anywhere]">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{problem.statement || "No statement supplied."}</ReactMarkdown>
                    {problem.definitions && <><h3 className="font-semibold">Definitions</h3><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{problem.definitions}</ReactMarkdown></>}
                    {problem.assumptions && <><h3 className="font-semibold">Assumptions</h3><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{problem.assumptions}</ReactMarkdown></>}
                  </div>
                  {problem.attribution && <p className="mt-4 text-xs text-black/50">{problem.attribution}</p>}
                  {problem.sources.length > 0 && <ul className="mt-4 space-y-2 text-xs">{problem.sources.map((source, index) => <li key={`${source.url}-${index}`}><a className="underline underline-offset-4" href={/^https?:\/\//i.test(source.url) ? source.url : undefined} target="_blank" rel="noreferrer">{source.title || "Source"}</a>{source.location && <span className="text-black/50"> · {source.location}</span>}</li>)}</ul>}
                  <Link href={`/dashboard?problem=${encodeURIComponent(problem.slug)}`} scroll={false} className="mt-5 inline-flex rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-black/80">Research this problem</Link>
                </div>
              </details>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-black/60">
            <p aria-live="polite">Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()} problems</p>
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-black/15 px-3 py-2 disabled:opacity-30" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
              <span>Page {currentPage + 1} of {pageCount}</span>
              <button className="rounded-lg border border-black/15 px-3 py-2 disabled:opacity-30" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
