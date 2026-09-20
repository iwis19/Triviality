"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconArrowUpRight } from "@tabler/icons-react";
import { DashboardSidebar } from "../dashboard-sidebar";
import { DashboardTopbar } from "../dashboard-topbar";
import { ResearchGraph } from "@/components/research-graph";
import { getResearchJobs, type ResearchJob } from "@/lib/research-store";

export default function ResearchGraphPage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);

  useEffect(() => {
    const refresh = () => {
      getResearchJobs().then(setJobs).catch(() => setJobs([]));
    };
    refresh();
    const interval = window.setInterval(refresh, 900);
    return () => window.clearInterval(interval);
  }, []);

  const graphJobs = jobs.filter((job) => job.nodes.length > 0);

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f5f5] text-[#111] md:flex-row">
      <DashboardSidebar />
      <div className="min-w-0 flex-1">
        <DashboardTopbar page="Research graph" />
        <section className="mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-14">
          <h1 className="sr-only">Research graph</h1>
          <Link className="mb-6 inline-flex items-center gap-2 text-xs text-black/45 hover:text-black" href="/dashboard"><IconArrowLeft size={14} /> Overview</Link>
          {graphJobs.length === 0 ? <EmptyGraph /> : (
            <div className="space-y-8">
              {graphJobs.map((job) => (
                <section key={job.id}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold tracking-[-0.04em]">{job.title}</h2>
                    <Link className="inline-flex items-center gap-2 text-xs text-black/50 hover:text-black" href={`/dashboard/research/${job.id}`}>View research <IconArrowUpRight size={14} /></Link>
                  </div>
                  <ResearchGraph job={job} compact />
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function EmptyGraph() {
  return <div className="py-16 text-center"><p className="text-sm text-black/50">No research graphs yet.</p><Link className="mt-5 inline-flex rounded-md bg-black px-5 py-3 text-sm font-medium text-white" href="/dashboard">Start research</Link></div>;
}
