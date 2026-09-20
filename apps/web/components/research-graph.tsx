"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { ResearchJob, ResearchNodeType } from "@/lib/research-store";

const stages: { label: string; types: ResearchNodeType[] }[] = [
  { label: "Question", types: ["problem"] },
  { label: "Investigations", types: ["hypothesis", "lemma"] },
  { label: "Proof & outcome", types: ["proof", "formalization", "result"] },
];

export function ResearchGraph({ job, compact = false }: { job: ResearchJob; compact?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = job.nodes.filter((node) => node.type !== "paper");
  const relations = job.edges.filter((edge) => (edge.source === selected || edge.target === selected) && nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target));
  return <section className="overflow-hidden rounded-2xl border border-black/10 bg-white">
    <div className="border-b border-black/10 px-5 py-4">
      <h2 className="text-sm font-semibold">Research graph</h2>
      <p className="mt-1 text-xs leading-5 text-black/50">Select a card for its full findings and relationships. Papers remain in the Literature tab.</p>
    </div>
    <div className={`grid gap-5 p-5 ${compact ? "" : "xl:grid-cols-3"}`}>
      {stages.map((stage, index) => <div key={stage.label} className="min-w-0">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-black/45">0{index + 1} / {stage.label}</h3>
        <div className="space-y-3">{nodes.filter((node) => stage.types.includes(node.type)).map((node) => <button key={node.id} type="button" aria-pressed={selected === node.id} onClick={() => setSelected(selected === node.id ? null : node.id)} className={`w-full rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 ${selected === node.id ? "border-black bg-black text-white" : "border-black/10 bg-[#fafafa] hover:border-black/40"}`}>
          <span className="block text-sm font-semibold break-words">{node.label}</span>
          <span className="mt-2 block whitespace-pre-wrap text-xs leading-6 opacity-65 [overflow-wrap:anywhere]">{node.detail.split(/\n\s*\n|(?<=\.)\s/)[0]}</span>
          <span className="mt-3 block text-[9px] uppercase tracking-widest opacity-50">{node.type} · {node.status}</span>
        </button>)}</div>
      </div>)}
    </div>
    {selected && <div className="border-t border-black/10 bg-[#fafafa] p-5" aria-live="polite"><div className="mb-5 space-y-3 text-sm leading-7 [overflow-wrap:anywhere]"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{nodes.find((node) => node.id === selected)?.detail ?? ""}</ReactMarkdown></div><h3 className="text-xs font-semibold">Recorded relationships</h3>{relations.length ? <ul className="mt-3 space-y-2 text-xs leading-6 text-black/65">{relations.map((edge, index) => <li key={index}><strong>{nodes.find((node) => node.id === edge.source)?.label}</strong> → <span>{edge.label || "related to"}</span> → <strong>{nodes.find((node) => node.id === edge.target)?.label}</strong></li>)}</ul> : <p className="mt-2 text-xs text-black/50">No relationships recorded for this card.</p>}</div>}
  </section>;
}
