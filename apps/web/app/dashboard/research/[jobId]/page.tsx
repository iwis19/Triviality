"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useParams } from "next/navigation";
import { IconArrowLeft, IconCheck, IconCode, IconFileDescription, IconLoader2 } from "@tabler/icons-react";
import { DashboardSidebar } from "../../dashboard-sidebar";
import { DashboardTopbar } from "../../dashboard-topbar";
import { ResearchGraph } from "@/components/research-graph";
import { ResearchLiteratureTabs } from "@/components/research-literature-tabs";
import { ModelLabel } from "@/components/model-select";
import { ResearchStatusBadge } from "@/components/research-status-badge";
import { getResearchJob, modelCatalog, type ResearchJob } from "@/lib/research-store";

type ArtifactTab = "literature" | "lean" | "latex";

export default function ResearchEpisodePage() {
  const params = useParams<{ jobId: string }>();
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ArtifactTab>("latex");

  useEffect(() => {
    const refresh = () => getResearchJob(params.jobId).then(setJob).catch((reason: Error) => setError(reason.message));
    void refresh();
    const interval = window.setInterval(refresh, 650);
    return () => window.clearInterval(interval);
  }, [params.jobId]);

  if (!job) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] text-sm text-black/55">{error ?? "Loading research…"}</main>;
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f5f5] text-[#111] md:flex-row">
      <DashboardSidebar />
      <div className="min-w-0 flex-1">
        <DashboardTopbar page="Research" />
        <section className="mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-14">
          <Link className="mb-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 hover:text-black" href="/dashboard"><IconArrowLeft size={14} /> Overview</Link>

          <div className="border-b border-black/10 pb-10">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-3"><ResearchStatusBadge job={job} /></div>
              <h1 className="max-w-4xl text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{job.title}</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-black/55">{job.statement}</p>
            </div>
          </div>

          {job.roleModels && <section className="mt-6 rounded-xl border border-black/10 bg-white p-5"><h2 className="text-sm font-semibold">Models</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(job.roleModels).map(([roleId, modelId]) => <div key={roleId}><dt className="text-xs text-black/45">{modelCatalog.roles.find((role) => role.id === roleId)?.label ?? roleId.replaceAll("_", " ")}</dt><dd className="mt-1"><ModelLabel id={modelId} fallbackLabel={modelId} /></dd></div>)}</dl></section>}
          {job.status === "running" ? <RunningEpisode /> : job.status === "failed" ? <FailedEpisode job={job} /> : <CompletedEpisode job={job} tab={tab} setTab={setTab} />}
          {(job.orchestrator === "workswarm" || job.provider === "huawei") && <><ExplorationBanks job={job} /><TeamTrace job={job} /></>}
        </section>
      </div>
    </main>
  );
}

function ExplorationBanks({ job }: { job: ResearchJob }) {
  return <section className="mt-8 space-y-5">
    <h2 className="text-lg font-semibold">Exploration · {job.explorationRounds ?? 4} rounds maximum</h2>
    <div className="grid gap-4 md:grid-cols-3">{(job.branches ?? []).filter(Boolean).map((branch) => <article key={branch.id} className="rounded-xl border border-black/10 bg-white p-5">
      <h3 className="text-sm font-semibold">Researcher {branch.id} · direction {branch.generation + 1}</h3><p className="mt-2 text-xs text-black/50">{branch.status} · {branch.stagnation}/{job.stagnationThreshold ?? 2} stagnant exchanges</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{branch.assignment}</p>
    </article>)}</div>
    <details className="rounded-xl border border-black/10 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">Literature bank · {job.literature.length} sources retrieved for this episode</summary><div className="mt-4"><ResearchLiteratureTabs jobId={job.id} papers={job.literature} /></div></details>
    <details open className="rounded-xl border border-black/10 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">Discovery bank · {job.discoveries?.length ?? 0} findings and challenges</summary>
      <p className="mt-3 text-xs text-black/50">Reviewed findings are model assessments. Only verification entries marked verified have passed Lean.</p>
      <div className="mt-4 space-y-3">{(job.discoveries ?? []).map((entry) => <details key={entry.id} className="rounded-lg border border-black/10 p-4"><summary className="cursor-pointer text-sm">Researcher {entry.branch} · round {entry.round} · {entry.kind} · {entry.status}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{entry.content}</p>{entry.evidence && <p className="mt-3 whitespace-pre-wrap text-sm">Evidence: {entry.evidence}</p>}{entry.resolution_test && <p className="mt-3 whitespace-pre-wrap text-sm">Resolution test: {entry.resolution_test}</p>}{entry.reason && <p className="mt-3 whitespace-pre-wrap text-xs">{entry.reason}</p>}{entry.source_ids?.length ? <p className="mt-3 text-xs">Sources: {entry.source_ids.map((id) => job.literature.find((paper) => paper.id === id)?.title ?? id).join("; ")}</p> : null}</details>)}</div>
    </details>
  </section>;
}

function TeamTrace({ job }: { job: ResearchJob }) {
  const decisions = (job.events ?? []).flatMap((event) => {
    const progress = event.payload.event as { kind?: string; message?: string } | undefined;
    if (event.type !== "research.swarm.event" || progress?.kind !== "log" || !progress.message?.startsWith("TRIVIALITY_EVENT ")) return [];
    try { return [{ id: event.id, ...JSON.parse(progress.message.slice(17)) } as { id: string; kind: string; feedback?: string; summary?: string; reason?: string }]; }
    catch { return []; }
  }).filter((event) => ["round", "restart", "replan", "repair", "reassignment", "delivery"].includes(event.kind));
  return <details className="mt-10 rounded-2xl border border-black/10 bg-white p-6">
    <summary className="cursor-pointer text-sm font-semibold">Research team collaboration <span className="ml-2 font-normal text-black/45">{job.attempts.length} attempts</span></summary>
    <p className="mt-3 text-sm text-black/55">Research findings, critique, and proof handoffs.</p>
    <div className="mt-5 space-y-3">{job.attempts.map((attempt) => <details key={attempt.id} className="rounded-xl border border-black/10 p-4"><summary className="cursor-pointer text-sm"><strong>{attempt.role}</strong><span className="ml-3 text-xs text-black/45">{attempt.status}</span></summary><p className="mt-3 text-xs text-black/45">{attempt.strategy}</p><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-6 text-black/60">{attempt.result}</pre></details>)}</div>
    {decisions.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold">Team decisions ({decisions.length})</summary>{decisions.map((event) => <p key={event.id} className="mt-3 border-l-2 border-black/30 pl-3 text-xs leading-6 text-black/65"><strong>{event.kind}: </strong>{event.feedback ?? event.summary ?? event.reason}</p>)}</details>}
  </details>;
}

function RunningEpisode() {
  return <div role="status" className="flex items-center gap-3 py-12 text-sm text-black/55"><IconLoader2 className="animate-spin" size={20} />Research in progress…</div>;
}

function FailedEpisode({ job }: { job: ResearchJob }) {
  return <div className="mx-auto max-w-2xl py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-900/20 text-red-900">!</div><p className="mt-6 text-2xl font-semibold tracking-[-0.05em]">Research failed.</p><div className="mt-8 rounded-xl border border-red-900/15 bg-red-50 p-5 text-left text-sm leading-6 text-red-950">{job.error ?? job.stage}</div><Link className="mt-8 inline-flex rounded-full bg-black px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white" href="/dashboard">Return to overview</Link></div>;
}

function CompletedEpisode({ job, tab, setTab }: { job: ResearchJob; tab: ArtifactTab; setTab: (tab: ArtifactTab) => void }) {
  return <div className="space-y-14 pt-10">
    <section className={`rounded-2xl border p-7 sm:p-9 ${job.proof?.status === "verified" ? "border-black bg-[#151515] text-white" : "border-yellow-300 bg-yellow-50 text-yellow-900"}`}>
      <div className="flex items-start gap-5"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-current/25">{job.proof?.status === "verified" ? <IconCheck size={28} stroke={2.5} /> : <IconFileDescription size={24} />}</span><div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-55">Episode result</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{job.proof?.status === "verified" ? "PASS · Lean proof checked" : "Unverified"}</h2>
        {job.proof?.status !== "verified" && <p className="mt-3 text-sm leading-7">The research run finished, but no passed Lean verification is recorded. Treat the result as an unverified candidate.</p>}
        <p className="mt-3 max-w-3xl text-sm leading-7 opacity-70">{job.summary}</p>
        <a href="#proof-artifacts" onClick={() => setTab("latex")} className="mt-5 inline-block border-b border-current/40 pb-1 text-sm font-semibold">Read the written result ↓</a>
      </div></div>
    </section>
    <section id="proof-artifacts" className="scroll-mt-6"><div className="mb-6 flex flex-col justify-between gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-end"><div><SectionLabel>Generated research</SectionLabel><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">Literature and proof artifacts</h2></div><div className="flex gap-1 rounded-full border border-black/10 p-1">{(["literature", "lean", "latex"] as ArtifactTab[]).map((item) => <button key={item} className={`rounded-full px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.15em] transition ${tab === item ? "bg-black text-white" : "text-black/45 hover:text-black"}`} onClick={() => setTab(item)}>{item === "lean" ? "Lean 4" : item}</button>)}</div></div>{tab === "literature" ? <ResearchLiteratureTabs jobId={job.id} papers={job.literature} /> : <ProofArtifact job={job} tab={tab} />}</section>

    <ResearchGraph job={job} />

    <details className="rounded-2xl border border-black/10 bg-white p-6"><summary className="cursor-pointer text-sm font-semibold">Research frontier <span className="ml-2 font-normal text-black/45">{job.hypotheses.length} investigations</span></summary><div className="mt-5 space-y-4">{job.hypotheses.map((hypothesis) => <details key={hypothesis.id} className="rounded-xl border border-black/10 p-5"><summary className="cursor-pointer text-sm font-semibold">{hypothesis.title}</summary><div className="mt-4 space-y-3 text-sm leading-7 text-black/65"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{hypothesis.statement}</ReactMarkdown></div><p className="mt-4 text-xs text-black/45">{hypothesis.status}</p></details>)}</div></details>




  </div>;
}

function ProofArtifact({ job, tab }: { job: ResearchJob; tab: "lean" | "latex" }) {
  const [sourceVisible, setSourceVisible] = useState(false);
  if (!job.proof) return <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-sm leading-7 text-black/55"><h3 className="font-semibold text-black">No proof artifact was produced</h3><p className="mt-3">{job.summary}</p><p className="mt-3">The research findings and team handoffs below contain the available evidence.</p></div>;
  const proof = job.proof;
  const isLean = tab === "lean";
  const source = isLean ? proof.lean : proof.latex;
  const download = () => {
    const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = isLean ? "proof.lean" : "result.tex"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-6 py-4"><span className="flex items-center gap-2 text-xs font-semibold">{isLean ? <IconCode size={16} /> : <IconFileDescription size={16} />}{isLean ? "proof.lean" : "Written result · LaTeX mathematics"}</span><div className="flex gap-4 text-xs">{!isLean && <button onClick={() => setSourceVisible(!sourceVisible)} className="underline underline-offset-4">{sourceVisible ? "Read result" : "View .tex source"}</button>}<button disabled={!source} onClick={download} className="font-semibold disabled:opacity-40">Download {isLean ? ".lean" : ".tex"} ↓</button></div></div>
    {isLean || sourceVisible ? <pre className="max-h-[48rem] overflow-auto bg-[#101010] p-6 text-sm leading-7 text-white/80"><code>{source || "No source was saved for this episode."}</code></pre> : <article className="literature-markdown mx-auto max-w-3xl p-6 sm:p-10">
      <h3 className="text-3xl font-semibold tracking-tight">{job.title}</h3>
      <p className="mt-6 text-[10px] font-semibold uppercase tracking-widest text-black/40">Research question</p>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{job.statement}</ReactMarkdown></div>
      <h4 className="mb-4 mt-8 text-lg font-semibold">Proof exposition</h4>
      {proof.explanation?.trim() ? <div className="space-y-4 text-sm leading-8 text-black/75 [overflow-wrap:anywhere]"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{proof.explanation}</ReactMarkdown></div> : <p className="text-sm leading-7 text-black/55">This episode did not save a written proof explanation. {proof.latex?.trim() ? "Use View .tex source to inspect the available document." : "Start a new episode to generate a written proof alongside the Lean artifact."}</p>}
      <details className="mt-8 border-t border-black/10 pt-5"><summary className="cursor-pointer text-xs font-semibold">Exact formal statement checked by Lean</summary><pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs leading-6">{proof.statement}</pre></details>
    </article>}
  </div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-black/45">{children}</p>;
}
