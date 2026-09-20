import type { ResearchJob } from "@/lib/research-store";
import { getResearchStatus, researchStatusPresentation } from "@/lib/research-status";

type Props = { job: Pick<ResearchJob, "status" | "proof"> } | { state: keyof typeof researchStatusPresentation };

export function ResearchStatusBadge(props: Props) {
  const state = "job" in props ? getResearchStatus(props.job) : props.state;
  const presentation = researchStatusPresentation[state];
  const title = state === "completed_unverified" ? "Research finished, but no passed Lean verification is recorded." : presentation.label;
  return <span title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-normal ${presentation.badge}`}>
    <span aria-hidden="true">{state === "completed_unverified" ? "!" : state === "completed" ? "✓" : state === "failed" ? "×" : "•"}</span>
    {presentation.label}
  </span>;
}
