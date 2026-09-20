"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconFolder,
  IconMap2,
  IconMenu2,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { TrivialityLogo } from "@/components/triviality-logo";
import { getResearchStatus, researchStatusPresentation } from "@/lib/research-status";
import { deleteResearchJob, getResearchJobs, type ResearchJob } from "@/lib/research-store";

const hiddenPublishedProofKey = "triviality:hidden-chat:trihexagonal-shell:v2";

export function DashboardSidebar({ jobs: providedJobs, onDeleted }: { jobs?: ResearchJob[]; onDeleted?: (id: string) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [fetchedJobs, setFetchedJobs] = useState<ResearchJob[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPublishedProof, setShowPublishedProof] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.localStorage.removeItem("triviality:hidden-chat:trihexagonal-shell");
      setShowPublishedProof(window.localStorage.getItem(hiddenPublishedProofKey) !== "1");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (providedJobs) return;
    let cancelled = false;
    const refresh = () => getResearchJobs().then((jobs) => {
      if (!cancelled) setFetchedJobs(jobs);
    }).catch(() => undefined);
    void refresh();
    const interval = window.setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [providedJobs]);

  const jobs = providedJobs ?? fetchedJobs;
  const areas = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.area).filter(Boolean))).sort(),
    [jobs],
  );

  const content = (
    <SidebarContent
      areas={areas}
      jobs={jobs}
      pathname={pathname}
      onNavigate={() => setMobileOpen(false)}
      deletingId={deletingId}
      showPublishedProof={showPublishedProof}
      onRemovePublishedProof={() => {
        if (!window.confirm("Remove the trihexagonal shell result from Research chats? The result page will remain available.")) return;
        window.localStorage.setItem(hiddenPublishedProofKey, "1");
        setShowPublishedProof(false);
      }}
      onDelete={async (job) => {
        if (!window.confirm(`Delete “${job.title}”? This permanently removes the chat and its private research history.`)) return;
        setDeletingId(job.id);
        try {
          await deleteResearchJob(job.id);
          setFetchedJobs((current) => current.filter((item) => item.id !== job.id));
          onDeleted?.(job.id);
          if (pathname.endsWith(job.id)) router.push("/dashboard");
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "Could not delete this chat.");
        } finally {
          setDeletingId(null);
        }
      }}
    />
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r border-black/8 bg-[#f7f7f8] md:block">
        {content}
      </aside>

      <div className="flex h-14 items-center justify-between border-b border-black/8 bg-[#f7f7f8] px-4 md:hidden">
        <TrivialityLogo />
        <button
          type="button"
          aria-label="Open workspace navigation"
          className="rounded-lg p-2 hover:bg-black/5"
          onClick={() => setMobileOpen(true)}
        >
          <IconMenu2 size={20} />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/25 md:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-[min(20rem,88vw)] bg-[#f7f7f8] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label="Close workspace navigation"
              className="absolute left-[min(17rem,calc(88vw-3rem))] top-3 rounded-lg p-2 hover:bg-black/5"
              onClick={() => setMobileOpen(false)}
            >
              <IconX size={20} />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarContent({
  areas,
  jobs,
  pathname,
  onNavigate,
  deletingId,
  onDelete,
  showPublishedProof,
  onRemovePublishedProof,
}: {
  areas: string[];
  jobs: ResearchJob[];
  pathname: string;
  onNavigate: () => void;
  deletingId: string | null;
  onDelete: (job: ResearchJob) => void;
  showPublishedProof: boolean;
  onRemovePublishedProof: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-3 py-3 text-[#202020]">
      <div className="flex h-11 items-center px-2">
        <TrivialityLogo />
      </div>

      <Link
        href="/dashboard?new=1"
        onClick={onNavigate}
        className="mt-3 flex h-11 items-center gap-3 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium shadow-sm transition hover:bg-black/[0.025]"
      >
        <IconPlus size={18} />
        New research
      </Link>

      <nav className="mt-3 space-y-1" aria-label="Workspace navigation">
        <SidebarItem href="/explore" icon={<IconMap2 size={18} />} label="Atlas explorer" onNavigate={onNavigate} />
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:thin]">
        {areas.length > 0 && (
          <section>
            <p className="px-2 text-[11px] font-medium text-black/45">Projects</p>
            <div className="mt-2 space-y-0.5">
              {areas.map((area) => (
                <SidebarItem
                  key={area}
                  href={`/dashboard?area=${encodeURIComponent(area)}`}
                  icon={<IconFolder size={17} />}
                  label={area}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        )}

        <section className={areas.length > 0 ? "mt-7" : ""}>
          <p className="px-2 text-[11px] font-medium text-black/45">Research chats</p>
          <div className="mt-2 space-y-0.5">
            {showPublishedProof && <div className="group flex items-center rounded-lg hover:bg-black/5">
              <Link
                href="/proofs/trihexagonal-shell"
                onClick={onNavigate}
                title="Trihexagonal shell: a counterexample to the proposed bound"
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${pathname === "/proofs/trihexagonal-shell" ? "bg-black/[0.07]" : ""}`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate">Trihexagonal shell counterexample</span>
              </Link>
              <button
                aria-label="Remove Trihexagonal shell counterexample from Research chats"
                className="mr-1 rounded-md p-1.5 text-black/35 opacity-100 transition hover:bg-black/8 hover:text-red-700 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                onClick={onRemovePublishedProof}
                type="button"
              >
                <IconTrash size={14} />
              </button>
            </div>}
            {jobs.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-5 text-black/40">New research chats will appear here.</p>
            ) : (
              jobs.slice(0, 29).map((job) => (
                <div className="group flex items-center rounded-lg hover:bg-black/5" key={job.id}>
                  <Link
                    href={`/dashboard/research/${job.id}`}
                    onClick={onNavigate}
                    title={`${job.title} · ${researchStatusPresentation[getResearchStatus(job)].label}`}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition ${pathname.endsWith(job.id) ? "bg-black/[0.07]" : ""}`}
                  >
                    <span aria-label={researchStatusPresentation[getResearchStatus(job)].label} className={`h-1.5 w-1.5 shrink-0 rounded-full ${researchStatusPresentation[getResearchStatus(job)].dot}`} />
                    <span className="truncate">{job.title}</span>
                  </Link>
                  <button
                    aria-label={`Delete ${job.title}`}
                    className="mr-1 rounded-md p-1.5 text-black/35 opacity-100 transition hover:bg-black/8 hover:text-red-700 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100 disabled:cursor-wait"
                    disabled={deletingId === job.id}
                    onClick={() => onDelete(job)}
                    type="button"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mt-3 border-t border-black/8 pt-3">
        <SidebarItem href="/" icon={<IconArrowLeft size={18} />} label="Home" onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function SidebarItem({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-black/5"
    >
      <span className="shrink-0 text-black/65">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
