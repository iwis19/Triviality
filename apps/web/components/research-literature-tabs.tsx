import Link from "next/link";
import { ResearchMarkdown } from "@/components/research-markdown";
import { IconArrowUpRight, IconBook2 } from "@tabler/icons-react";
import type { ResearchLiterature } from "@/lib/research-store";

export function ResearchLiteratureTabs({ jobId, papers }: { jobId: string; papers: ResearchLiterature[] }) {
  if (!papers.length) {
    return <div className="rounded-2xl border border-dashed border-black/15 p-8 text-sm text-black/45">No papers attached.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="grid grid-cols-[minmax(0,1fr)_8rem_7rem_2rem] gap-3 border-b border-black/10 bg-[#fafafa] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/40 sm:grid-cols-[minmax(0,1fr)_13rem_10rem_3rem] sm:px-5">
        <span>Paper</span>
        <span>Source</span>
        <span>Role</span>
        <span />
      </div>

      <div className="divide-y divide-black/10" role="list" aria-label="Literature">
        {papers.map((paper, index) => (
          <Link
            className="grid grid-cols-[minmax(0,1fr)_8rem_7rem_2rem] gap-3 px-4 py-4 text-left transition hover:bg-black/[.025] focus-visible:bg-black/[.04] focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_13rem_10rem_3rem] sm:px-5"
            href={`/dashboard/research/${encodeURIComponent(jobId)}/literature/${encodeURIComponent(paper.id)}`}
            key={paper.id}
            role="listitem"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/10 text-[10px] font-mono text-black/40">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-[-0.03em]"><ResearchMarkdown inline>{paper.title}</ResearchMarkdown></span>
                <span className="mt-1 block truncate text-[11px] text-black/45">{paper.authors}</span>
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-2 text-xs text-black/55"><IconBook2 className="shrink-0" size={14} /> <span className="truncate">{paper.source}</span></span>
            <span className="flex items-center"><span className="rounded-md bg-black/[.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-black/55">{paper.discovery === "expanded" ? "Expanded" : "Seed"}</span></span>
            <IconArrowUpRight className="self-center text-black/30" size={16} />
          </Link>
        ))}
      </div>
    </div>
  );
}
