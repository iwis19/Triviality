"use client";

import { Suspense, useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowUpRight, IconChevronDown, IconChevronRight, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { motion } from "motion/react";
import { publicApi } from "../explore/api";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";
import { ModelSelect } from "@/components/model-select";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { createResearchJob, getResearchJobs, type ResearchJob, type ResearchProvider, modelCatalog, defaultRoleModels, type RoleModels } from "@/lib/research-store";

const providers: Array<{ id: ResearchProvider; name: string; description: string; logo: string }> = [
  { id: "openai", name: "OpenAI", description: "Hypotheses, synthesis, and formalization.", logo: "https://models.dev/logos/openai.svg" },
  { id: "devin", name: "Devin", description: "Autonomous research agents and critique.", logo: "https://devin.ai/favicon.ico" },

];

type ResearchForm = {
  title: string;
  statement: string;
  area: string;
  roleModels: RoleModels;
  mode: string;
  budget: number;
  leanStatement: string;
  problemSlug?: string;
};

const initialForm: ResearchForm = {
  title: "",
  statement: "",
  area: "Combinatorics",
  roleModels: { ...defaultRoleModels },
  mode: "Diverse portfolio",
  budget: 2,
  leanStatement: "",
};

export default function DashboardPage() {
  return <Suspense fallback={<div className="p-8 text-sm text-black/40">Loading workspace…</div>}><DashboardContent /></Suspense>;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const sourceProblem = searchParams.get("problem");
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

  const closeModal = () => {
    setModalOpen(false);
    if (sourceProblem) router.replace("/dashboard", { scroll: false });
  };

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return jobs;
    return jobs.filter((job) => `${job.title} ${job.statement} ${job.area} ${job.orchestrator ?? job.provider}`.toLowerCase().includes(normalized));
  }, [jobs, query]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.statement.trim()) return;

    setSubmitError(null);
    setCreating(true);
    createResearchJob(form)
      .then((job) => router.push(`/dashboard/research/${job.id}`))
      .catch((reason: Error) => {
        setSubmitError(reason.message);
        setCreating(false);
      });
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f5f5] text-[#111] md:flex-row">
      <DashboardSidebar />
      <div className="min-w-0 flex-1">
        <DashboardTopbar page="Overview" />
        <section className="mx-auto max-w-7xl px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <div className="flex flex-col justify-between gap-8 border-b border-black/10 pb-10 lg:flex-row lg:items-end">
            <div>
              <HoverBorderGradient containerClassName="rounded-md" className="flex items-center gap-2 rounded-[inherit] bg-black px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white" duration={1.2} onClick={() => { setForm(initialForm); setSubmitError(null); setModalOpen(true); }}><IconPlus size={14} /> New research</HoverBorderGradient>
            </div>
            <label className="relative block w-full sm:w-72 lg:ml-auto"><IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35" size={16} /><input className="h-11 w-full rounded-xl border border-black/12 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-black/35 focus:border-black/40" placeholder="Search research" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>

          {error && <div className="mt-5 rounded-xl border border-red-900/15 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}

          <section className="mt-8" id="jobs">
            <div className="mb-5 flex items-end justify-between gap-6"><h1 className="text-xl font-semibold tracking-[-0.04em]">Research</h1><Link className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 hover:text-black" href="/dashboard/graph">Research graph <IconArrowUpRight size={14} /></Link></div>
            {filteredJobs.length === 0 ? <div className="rounded-lg border border-dashed border-black/15 px-6 py-14 text-center text-sm text-black/45">{jobs.length === 0 ? "No research yet." : "No matching research."}</div> : <div className="grid gap-3">{filteredJobs.map((job) => <EpisodeRow key={job.id} job={job} />)}</div>}
          </section>
        </section>
        {modalOpen && <ResearchDeployModal form={form} setForm={setForm} creating={creating} error={submitError} onClose={closeModal} onSubmit={submit} />}
      </div>
    </main>
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
          <section className="border-b border-black/10 p-5 sm:p-6">
            <h3 className="text-base font-semibold">Models by role</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {modelCatalog.roles.map((role) => <div key={role.id} className="grid content-start gap-1.5">
                <ModelSelect label={role.label} value={form.roleModels[role.id]} onChange={(value) => setForm((current) => ({ ...current, roleModels: { ...current.roleModels, [role.id]: value } }))} />
                <span className="text-xs font-normal leading-5 text-black/45">{role.description}</span>
              </div>)}
            </div>
          </section>

          <section className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
              {<button type="button" className="w-fit text-sm underline underline-offset-4 lg:col-span-2" onClick={() => setForm((current) => ({ ...current, problemSlug: undefined, title: "Addition preserves order", statement: "Prove that adding the same natural number to both sides preserves an inequality. Explore a direct arithmetic proof and independently examine the assumptions and possible counterexamples.", area: "Number theory", leanStatement: "(a b c : Nat) (h : a ≤ b) : a + c ≤ b + c", budget: 2 }))}>Use example</button>}
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium">Title<input required className="h-11 rounded-md border border-black/12 bg-white px-3.5 text-sm font-normal outline-none transition focus:border-black/45" placeholder="e.g. Compactness methods in finite graph theory" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Problem<textarea required className="min-h-24 resize-y rounded-md border border-black/12 bg-white px-3.5 py-2.5 text-sm font-normal leading-6 outline-none transition focus:border-black/45" placeholder="What do you want to prove?" value={form.statement} onChange={(event) => setForm((current) => ({ ...current, statement: event.target.value }))} /></label>
            </div>
            <div className="grid content-start gap-4">
              <FieldSelect label="Area" value={form.area} onChange={(value) => setForm((current) => ({ ...current, area: value }))} options={Array.from(new Set([form.area, "Algebra", "Analysis", "Combinatorics", "Geometry", "Logic", "Number theory", "Topology"]))} />

              <label className="grid gap-1.5 text-sm font-medium">Proof attempts (1-6)<input className="h-11 rounded-md border border-black/12 bg-white px-3.5 text-sm font-normal outline-none" min={1} max={6} type="number" value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: Number(event.target.value) }))} /></label>
            </div>
          </section>
        {<label className="grid gap-2 border-t border-black/10 px-6 py-4 text-sm font-medium">Exact Lean target (optional)<textarea className="min-h-16 rounded-md border border-black/12 p-3 font-mono text-xs" value={form.leanStatement} onChange={(event) => setForm((current) => ({ ...current, leanStatement: event.target.value }))} placeholder="(a b c : Nat) (h : a ≤ b) : a + c ≤ b + c" /><span className="text-xs font-normal text-black/50">Without a supplied target, a checked formalization still needs your review of the mathematical statement.</span></label>}
        </div>

        <div className="flex flex-col gap-3 border-t border-black/10 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
          <div className="flex justify-end gap-3">
            <button className="h-10 rounded-md border border-black/12 px-4 text-sm font-medium transition hover:bg-black/5" onClick={onClose} type="button">Cancel</button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-black px-5 text-sm font-medium text-white transition hover:bg-black/75 disabled:cursor-wait disabled:opacity-50" disabled={creating} type="submit"><IconPlus size={16} />{creating ? "Starting…" : "Start research"}</button>
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

function providerFor(provider?: ResearchProvider) {
  return providers.find((item) => item.id === provider) ?? providers[0];
}

function EpisodeRow({ job }: { job: ResearchJob }) {
  const modelCount = job.roleModels ? new Set(Object.values(job.roleModels)).size : 0;
  return <Link className="block overflow-hidden rounded-sm border border-black/10 bg-white" href={`/dashboard/research/${job.id}`}><div className="hidden gap-3 sm:grid border-b border-black/10 bg-[#fafafa] px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/40 sm:grid-cols-[minmax(16rem,1fr)_12rem_10rem_2.5rem]"><span>Name</span><span>Research team</span><span>Status</span><span /></div><div className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(16rem,1fr)_12rem_10rem_2.5rem] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold tracking-[-0.02em]">{job.title}</p><p className="mt-1 truncate text-[11px] text-black/45">{job.statement}</p></div><div className="flex items-center gap-2.5"><span className="text-xs">{job.orchestrator === "workswarm" || job.provider === "huawei" ? "WorkSwarm" : providerFor(job.provider).name}<span className="mt-1 block text-[10px] text-black/45">{job.roleModels ? `${modelCount} ${modelCount === 1 ? "model" : "models"} · 5 roles` : "Legacy research"}</span></span></div><div><span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${job.status === "completed" ? "bg-black text-white" : job.status === "failed" ? "bg-red-50 text-red-900" : "bg-black/7 text-black/55"}`}>{job.status}</span><p className="mt-1.5 text-[10px] text-black/40">{job.status === "running" ? `${job.progress}% · ${job.stage}` : job.area}</p></div><IconChevronRight className="text-black/30" size={16} /></div></Link>;
}
