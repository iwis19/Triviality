"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconArrowUpRight, IconBook2 } from "@tabler/icons-react";
import { DashboardSidebar } from "../dashboard-sidebar";
import { DashboardTopbar } from "../dashboard-topbar";
import { getResearchJobs, type ResearchJob, type ResearchLiterature } from "@/lib/research-store";

export default function LiteraturePage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  useEffect(() => {
    const refresh = () => getResearchJobs().then((next) => setJobs(next.filter((job) => job.status === "completed"))).catch(() => setJobs([]));
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => window.clearInterval(interval);
  }, []);
  const notes = useMemo(() => jobs.flatMap((job) => job.literature.map((paper) => ({ ...paper, job }))), [jobs]);

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f5f5] text-[#111] md:flex-row">
      <DashboardSidebar />
      <div className="min-w-0 flex-1">
        <DashboardTopbar page="Literature" />
        <section className="mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-14">
          <h1 className="sr-only">Literature</h1>
          <Link className="mb-6 inline-flex items-center gap-2 text-xs text-black/45 hover:text-black" href="/dashboard"><IconArrowLeft size={14} /> Overview</Link>
          {notes.length === 0 ? <EmptyLiterature /> : <div className="grid gap-4 md:grid-cols-2">{notes.map(({ job, ...paper }) => <LiteratureCard key={`${job.id}-${paper.id}`} job={job} paper={paper} />)}</div>}
        </section>
      </div>
    </main>
  );
}

function LiteratureCard({ job, paper }: { job: ResearchJob; paper: ResearchLiterature }) {
  return <article className="rounded-2xl border border-black/10 p-6 transition hover:border-black/30"><div className="flex items-center justify-between gap-4 text-xs text-black/45"><span className="flex items-center gap-2"><IconBook2 size={14} /> {paper.source}</span><span>{paper.year}</span></div><h2 className="mt-4 text-xl font-semibold tracking-[-0.04em]">{paper.title}</h2><p className="mt-2 text-xs text-black/45">{paper.authors}</p><p className="mt-5 text-sm leading-7 text-black/60">{paper.summary}</p><p className="mt-5 border-t border-black/10 pt-4 text-xs leading-5 text-black/50">{paper.relevance}</p><div className="mt-6 flex flex-wrap items-center gap-5"><Link className="inline-flex items-center gap-2 text-xs text-black/50 hover:text-black" href={`/dashboard/research/${job.id}`}>View research <IconArrowUpRight size={14} /></Link><Link className="inline-flex items-center gap-2 text-xs text-black/50 hover:text-black" href={`/dashboard/research/${encodeURIComponent(job.id)}/literature/${encodeURIComponent(paper.id)}`}>Read paper <IconArrowUpRight size={14} /></Link></div></article>;
}

function EmptyLiterature() {
  return <div className="py-16 text-center"><p className="text-sm text-black/50">No papers yet.</p><Link className="mt-5 inline-flex rounded-md bg-black px-5 py-3 text-sm font-medium text-white" href="/dashboard">Start research</Link></div>;
}
