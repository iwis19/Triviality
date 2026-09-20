import type { ResearchJob } from "./research-store";

// Execution can finish successfully without producing a Lean-verified proof.
export function getResearchStatus(job: Pick<ResearchJob, "status" | "proof">) {
  if (job.status === "running") return "running";
  if (job.status === "failed") return "failed";
  return job.proof?.status === "verified" ? "completed" : "completed_unverified";
}

export const researchStatusPresentation = {
  running: { label: "Running", badge: "border-blue-200 bg-blue-50 text-blue-800", dot: "bg-blue-500" },
  failed: { label: "Failed", badge: "border-red-200 bg-red-50 text-red-800", dot: "bg-red-500" },
  completed: { label: "Completed · Lean verified", badge: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  completed_unverified: { label: "Unverified", badge: "border-yellow-300 bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" },
};
