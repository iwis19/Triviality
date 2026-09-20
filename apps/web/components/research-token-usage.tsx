import type { ResearchJob } from "@/lib/research-store";

export function ResearchTokenUsage({ job }: { job: ResearchJob }) {
  const usage = (job.events ?? []).filter((event) => event.type === "research.swarm.event" && event.payload.kind === "usage");
  const spent = usage.reduce((sum, event) => sum + (typeof event.payload.tokens === "number" ? event.payload.tokens : 0), 0);
  const reportedLimit = usage.findLast((event) => typeof event.payload.limit === "number")?.payload.limit;
  const limit = job.tokenBudget ?? (typeof reportedLimit === "number" ? reportedLimit : undefined);
  if (limit === undefined && usage.length === 0) return null;
  return <section className="mt-6 rounded-xl border border-black/10 bg-white p-5" aria-label="Token usage">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Token usage</h2><p className="text-sm tabular-nums">{spent.toLocaleString("en-US")}{limit !== undefined ? ` / ${limit.toLocaleString("en-US")}` : " used"}</p></div>
    {limit !== undefined && <progress aria-label="Tokens used" className="mt-3 h-2 w-full accent-black" max={limit} value={Math.min(spent, limit)} />}
    <p className="mt-2 text-xs leading-5 text-black/55">Reported input and output tokens across the team. New runs reserve 35% for proof writing and Lean repair. Devin ACUs are separate.</p>
  </section>;
}
