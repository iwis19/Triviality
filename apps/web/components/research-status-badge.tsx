import type { ResearchJob } from "@/lib/research-store";
import { getResearchStatus, researchStatusPresentation } from "@/lib/research-status";

type Props = { job: Pick<ResearchJob, "status" | "proof"> } | { state: keyof typeof researchStatusPresentation };

export function ResearchStatusBadge(props: Props) {
  const state = "job" in props ? getResearchStatus(props.job) : props.state;
  if (state === "completed_unverified") return null;

  const presentation = researchStatusPresentation[state];
  return <span title={presentation.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-normal ${presentation.badge}`}>
    <span aria-hidden="true">{state === "completed" ? "✓" : state === "failed" ? "×" : "•"}</span>
    {presentation.label}
  </span>;
}
