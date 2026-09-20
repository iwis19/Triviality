import type { ResearchJob } from "@/lib/research-store";
import { getResearchStatus, researchStatusPresentation } from "@/lib/research-status";

export function ResearchStatusBadge({ job }: { job: Pick<ResearchJob, "status" | "proof"> }) {
  const state = getResearchStatus(job);
  const presentation = researchStatusPresentation[state];
  return <span title={state === "completed_unverified" ? "Research finished, but no passed Lean verification is recorded." : presentation.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-normal ${presentation.badge}`}>
    <span aria-hidden="true">{state === "completed_unverified" ? "!" : state === "completed" ? "✓" : state === "failed" ? "×" : "•"}</span>
    {presentation.label}
  </span>;
}
