"use client";

import { Suspense, useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import Link from "next/link";
import { trihexagonalDemo } from "@/lib/trihexagonal-demo";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown, IconChevronRight, IconMessage, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { motion } from "motion/react";
import { publicApi } from "../explore/api";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";
import { ModelSelect } from "@/components/model-select";
import { ResearchStatusBadge } from "@/components/research-status-badge";
import { createResearchJob, getResearchJobs, type ResearchJob, modelCatalog, defaultRoleModels, type RoleModels } from "@/lib/research-store";

type ResearchForm = {
  title: string;
  statement: string;
  area: string;
  roleModels: RoleModels;
  mode: string;
  budget: number;
  tokenBudget: number;
  explorationRounds: number;
  stagnationThreshold: number;
  leanStatement: string;
  problemSlug?: string;
};

const initialForm: ResearchForm = {
  title: "",
  statement: "",
  area: "Combinatorics",
  roleModels: { ...defaultRoleModels },
  mode: "Diverse portfolio",
  budget: 4,
  tokenBudget: 60000,
  explorationRounds: 4,
  stagnationThreshold: 2,
  leanStatement: "",
};

const trihexagonalProof = {
  title: "Trihexagonal shell: a counterexample to the proposed bound",
  statement: "A connected 23-cell shell enclosing a connected 31-cell hole.",
  area: "Combinatorics",
};

export default function DashboardPage() {
  return <Suspense fallback={<div className="p-8 text-sm text-black/40">Loading workspace…</div>}><DashboardContent /></Suspense>;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const sourceProblem = searchParams.get("problem");
  const areaFilter = searchParams.get("area");
  const startNewResearch = searchParams.get("new") === "1";
  const router = useRouter();
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ResearchForm>(initialForm);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => getResearchJobs().then(setJobs).catch((reason: Error) => setError(reason.message));
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sourceProblem) return;
    if (sourceProblem === trihexagonalDemo.slug) {
      setForm({ ...initialForm, title: trihexagonalDemo.title, statement: trihexagonalDemo.statement,
        area: trihexagonalDemo.area, problemSlug: trihexagonalDemo.slug });
      setSubmitError(null);
      setModalOpen(true);
      return;
    }
    let cancelled = false;
    publicApi.problem(sourceProblem).then(({ problem }) => {
      if (cancelled) return;
      setForm({ ...initialForm, title: problem.title,
        statement: [problem.statement, problem.definitions && `Definitions: ${problem.definitions}`, problem.assumptions && `Assumptions: ${problem.assumptions}`].filter(Boolean).join("\n\n"),
        area: problem.areas[0]?.name || "Mathematics", leanStatement: problem.formal_target || "", problemSlug: problem.slug });
      setSubmitError(null);
      setModalOpen(true);
    }).catch(() => { if (!cancelled) setError("Could not load the selected problem. Return to the explorer and try again."); });
    return () => { cancelled = true; };
  }, [sourceProblem]);

  useEffect(() => {
    if (!creating || form.problemSlug !== trihexagonalDemo.slug) return;
    const timer = window.setTimeout(() => window.location.assign(trihexagonalDemo.proofUrl), trihexagonalDemo.delayMs);
    return () => window.clearTimeout(timer);
  }, [creating, form.problemSlug]);

  const closeModal = () => {
    setCreating(false);
    setModalOpen(false);
    setForm(initialForm);
    setSubmitError(null);
    if (sourceProblem || startNewResearch) router.replace("/dashboard", { scroll: false });
  };

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return jobs.filter((job) =>
      (!areaFilter || job.area === areaFilter) &&
      (!normalized || `${job.title} ${job.statement} ${job.area} ${job.orchestrator ?? job.provider}`.toLowerCase().includes(normalized)),
    );
  }, [jobs, query, areaFilter]);
  const showTrihexagonalProof = (!areaFilter || areaFilter === trihexagonalProof.area)
    && (!query.trim() || `${trihexagonalProof.title} ${trihexagonalProof.statement} ${trihexagonalProof.area}`.toLowerCase().includes(query.trim().toLowerCase()));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating || !form.title.trim() || !form.statement.trim()) return;

    setSubmitError(null);
    setCreating(true);
    if (form.problemSlug === trihexagonalDemo.slug) return;
    createResearchJob(form)
      .then((job) => router.push(`/dashboard/research/${job.id}`))
      .catch((reason: Error) => {
        setSubmitError(reason.message);
        setCreating(false);
      });
  };

  return (
    <main className="flex min-h-dvh flex-col bg-white text-[#202020] md:flex-row">
      <DashboardSidebar jobs={jobs} onDeleted={(id) => setJobs((current) => current.filter((job) => job.id !== id))} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar page={areaFilter ?? "Research workspace"} />
        <section className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-16">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.05em]">{areaFilter ?? "Research chats"}</h1>
                <p className="mt-2 text-sm leading-6 text-black/50">Continue an investigation or begin a new mathematical research session.</p>
              </div>
              <button
                type="button"
                className="hidden shrink-0 items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/75 sm:flex"
                onClick={() => { setForm(initialForm); setSubmitError(null); setModalOpen(true); }}
              >
                <IconPlus size={17} />
                New chat
              </button>
            </div>

            <label className="relative mt-8 block">
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-black/35" size={17} />
              <input
                className="h-12 w-full rounded-2xl border border-black/10 bg-[#f7f7f8] pl-11 pr-4 text-sm outline-none transition placeholder:text-black/35 focus:border-black/25 focus:bg-white"
                placeholder="Search chats"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            {error && <div className="mt-5 rounded-xl border border-red-900/15 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}

            <section className="mt-10" id="jobs">
              <p className="mb-3 px-2 text-xs font-medium text-black/45">Recent</p>
              {!showTrihexagonalProof && filteredJobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/15 px-6 py-16 text-center">
                  <IconMessage className="mx-auto text-black/25" size={28} />
                  <p className="mt-4 text-sm text-black/45">{jobs.length === 0 ? "No research chats yet." : "No matching chats."}</p>
                  <button className="mt-5 text-sm font-medium underline underline-offset-4" onClick={() => setModalOpen(true)} type="button">Start a new research chat</button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-black/8 bg-white">
                  {showTrihexagonalProof && <PublishedProofRow />}
                  {filteredJobs.map((job) => <EpisodeRow key={job.id} job={job} />)}
                </div>
              )}
            </section>
          </div>
        </section>
        {(modalOpen || startNewResearch) && <ResearchDeployModal form={form} setForm={setForm} creating={creating} error={submitError} onClose={closeModal} onSubmit={submit} />}
      </div>
    </main>
  );
}

function PublishedProofRow() {
  return (
    <Link
      className="group flex items-center gap-4 border-b border-black/8 px-4 py-4 transition last:border-b-0 hover:bg-[#f7f7f8] sm:px-5"
      href="/proofs/trihexagonal-shell"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.055] text-black/55">
        <IconMessage size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{trihexagonalProof.title}</span>
        <span className="mt-1 block truncate text-xs text-black/45">{trihexagonalProof.statement}</span>
      </span>
      <span className="hidden shrink-0 text-right sm:block">
        <span className="block text-xs capitalize text-black/55">completed</span>
        <span className="mt-1 block text-[10px] text-black/35">{trihexagonalProof.area}</span>
      </span>
      <IconChevronRight className="shrink-0 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black/50" size={17} />
    </Link>
  );
}

function ResearchDeployModal({
  form,
  setForm,
  creating,
  error,
  onClose,
  onSubmit,
}: {
  form: ResearchForm;
  setForm: Dispatch<SetStateAction<ResearchForm>>;
  creating: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-3 backdrop-blur-[2px] sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="deploy-research-title">
      <motion.form className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-2xl sm:max-h-[calc(100vh-2.5rem)]" initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} onSubmit={onSubmit}>
        <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.05em]" id="deploy-research-title">New research</h2>
          </div>
          <button aria-label="Close new research dialog" className="rounded-md p-1.5 text-black/45 transition hover:bg-black/5 hover:text-black" onClick={onClose} type="button"><IconX size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="grid gap-x-6 gap-y-5 border-b border-black/10 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="grid min-h-full grid-rows-[auto_minmax(0,1fr)] gap-5">
              <label className="grid gap-1.5 text-sm font-medium">Title<input required className="h-11 rounded-md border border-black/12 bg-white px-3.5 text-sm font-normal outline-none transition focus:border-black/45" placeholder="e.g. Compactness methods in finite graph theory" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label className="grid min-h-0 grid-rows-[auto_minmax(8rem,1fr)] gap-1.5 text-sm font-medium">Problem<textarea required className="h-full min-h-32 resize-y rounded-md border border-black/12 bg-white px-3.5 py-2.5 text-sm font-normal leading-6 outline-none transition focus:border-black/45" placeholder="What do you want to prove?" value={form.statement} onChange={(event) => setForm((current) => ({ ...current, statement: event.target.value }))} /></label>
            </div>
            <div className="grid content-start gap-4">
              <FieldSelect label="Area" value={form.area} onChange={(value) => setForm((current) => ({ ...current, area: value }))} options={Array.from(new Set([form.area, "Algebra", "Analysis", "Combinatorics", "Geometry", "Logic", "Number theory", "Topology"]))} />

              <label className="grid gap-1.5 text-sm font-medium">Token budget<input required aria-describedby="token-budget-help" className="h-11 rounded-md border border-black/12 bg-white px-3.5 text-sm" min={10000} max={1000000} step={1000} type="number" value={form.tokenBudget} onChange={(event) => setForm((current) => ({ ...current, tokenBudget: Number(event.target.value) }))} /><span id="token-budget-help" className="text-xs font-normal leading-5 text-black/55">10,000–1,000,000 tokens across the team. Includes input and output; 35% reserved for proof and repair. Higher budgets can increase cost. Devin usage is measured separately in ACUs.</span></label>
              <label className="grid gap-1.5 text-sm font-medium">Proof attempts (1-6)<input className="h-11 rounded-md border border-black/12 bg-white px-3.5 text-sm font-normal outline-none" min={1} max={6} type="number" value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: Number(event.target.value) }))} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Exploration rounds (1–20)<input required className="h-11 rounded-md border border-black/12 bg-white px-3.5 text-sm" min={1} max={20} type="number" value={form.explorationRounds} onChange={(event) => setForm((current) => ({ ...current, explorationRounds: Number(event.target.value) }))} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Stagnation limit (1–6)<input required className="h-11 rounded-md border border-black/12 bg-white px-3.5 text-sm" min={1} max={6} type="number" value={form.stagnationThreshold} onChange={(event) => setForm((current) => ({ ...current, stagnationThreshold: Number(event.target.value) }))} /></label>
            </div>
            <button type="button" className="w-fit text-sm underline underline-offset-4 lg:col-span-2" onClick={() => setForm((current) => ({ ...current, problemSlug: undefined, title: "Addition preserves order", statement: "Prove that adding the same natural number to both sides preserves an inequality. Explore a direct arithmetic proof and independently examine the assumptions and possible counterexamples.", area: "Number theory", leanStatement: "(a b c : Nat) (h : a ≤ b) : a + c ≤ b + c", budget: 2 }))}>Use example</button>
          </section>

          <section className="border-b border-black/10 p-5 sm:p-6">
            <h3 className="text-base font-semibold">Models by role</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {modelCatalog.roles.map((role) => <ModelSelect key={role.id} label={role.label} value={form.roleModels[role.id]} onChange={(value) => setForm((current) => ({ ...current, roleModels: { ...current.roleModels, [role.id]: value } }))} />)}
            </div>
          </section>
        <label className="grid gap-2 border-t border-black/10 px-6 py-4 text-sm font-medium">Exact Lean target (optional)<textarea className="min-h-16 rounded-md border border-black/12 p-3 font-mono text-xs" value={form.leanStatement} onChange={(event) => setForm((current) => ({ ...current, leanStatement: event.target.value }))} placeholder="(a b c : Nat) (h : a ≤ b) : a + c ≤ b + c" /></label>
        </div>

        <div className="flex flex-col gap-3 border-t border-black/10 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
          <div className="flex justify-end gap-3">
            <button className="h-10 rounded-md border border-black/12 px-4 text-sm font-medium transition hover:bg-black/5" onClick={onClose} type="button">Cancel</button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-black px-5 text-sm font-medium text-white transition hover:bg-black/75 disabled:cursor-wait disabled:opacity-50" disabled={creating} type="submit"><IconPlus size={16} />{creating ? <span role="status" className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />Starting…</span> : "Start research"}</button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
}

function FieldSelect({ label, value, onChange, options, displayOptions }: { label: string; value: string; onChange: (value: string) => void; options: string[]; displayOptions?: Array<{ value: string; label: string }> }) {
  const values = displayOptions ?? options.map((option) => ({ value: option, label: option }));
  return <label className="grid gap-1.5 text-sm font-medium">{label}<span className="relative"><select className="h-11 w-full appearance-none rounded-md border border-black/12 bg-white px-3.5 pr-9 text-sm font-normal outline-none focus:border-black/45" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/50" size={16} /></span></label>;
}

function EpisodeRow({ job }: { job: ResearchJob }) {
  return (
    <Link
      className="group flex items-center gap-4 border-b border-black/8 px-4 py-4 transition last:border-b-0 hover:bg-[#f7f7f8] sm:px-5"
      href={`/dashboard/research/${job.id}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.055] text-black/55">
        <IconMessage size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{job.title}</span>
        <span className="mt-1 block truncate text-xs text-black/45">{job.statement}</span>
        <span className="mt-2 block sm:hidden"><ResearchStatusBadge job={job} /></span>
      </span>
      <span className="hidden shrink-0 text-right sm:block">
        <ResearchStatusBadge job={job} />
        <span className="mt-1 block text-[10px] text-black/35">{job.area}</span>
      </span>
      <IconChevronRight className="shrink-0 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black/50" size={17} />
    </Link>
  );
}
