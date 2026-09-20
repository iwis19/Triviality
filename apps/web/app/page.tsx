"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BellIcon,
  CalendarIcon,
  FileTextIcon,
  GlobeIcon,
  InputIcon,
} from "@radix-ui/react-icons";
import { ShaderBackground } from "@/components/ui/adisyon-shader";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { CloudShader } from "@/components/ui/cloud-shader";
import { TrivialityLogo } from "@/components/triviality-logo";
import { TextFlippingBoard } from "@/components/ui/text-flipping-board";

const MESSAGES: string[] = [
  "PROOF IS A\nCONSTRUCTION",
  "FIND THE\nINVARIANT",
  "LEMMA BECOMES\nTHEOREM",
  "EXPLORE THE\nUNKNOWN",
  "STRUCTURE\nBEATS SCALE",
  "CONJECTURE\nBECOMES\nTHEOREM",
];

const MESSAGE_INTERVAL = 10000;

const researchNetwork = [
  {
    name: "OpenAI",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/OpenAI_logo_2025_%28symbol%29.svg",
  },
  { name: "Anthropic", logo: "https://cdn.simpleicons.org/anthropic/111111" },
  { name: "Cursor", logo: "https://cdn.simpleicons.org/cursor/111111" },
  { name: "DeepMind", logo: "https://cdn.simpleicons.org/deepmind/111111" },
  { name: "Wolfram", logo: "https://cdn.simpleicons.org/wolfram/111111" },
  {
    name: "Lean",
    logo: "https://raw.githubusercontent.com/leanprover/theorem_proving_in_lean4/master/book/static/lean_logo.svg",
  },
  { name: "Mathlib", logo: "https://mathlib.org/favicon.svg" },
  { name: "arXiv", logo: "https://cdn.simpleicons.org/arxiv/111111" },
  { name: "NVIDIA", logo: "https://cdn.simpleicons.org/nvidia/111111" },
  { name: "Notion", logo: "https://cdn.simpleicons.org/notion/111111" },
];

const features = [
  {
    Icon: FileTextIcon,
    name: "Research graph",
    description: "Map theorems, techniques, assumptions, and ideas as one living system.",
    href: "#research",
    cta: "Explore graph",
    background: <GraphPreview />,
    className: "lg:col-start-2 lg:col-end-3 lg:row-start-1 lg:row-end-4",
  },
  {
    Icon: InputIcon,
    name: "Hypothesis engine",
    description: "Generate competing directions and keep every failed attempt as research data.",
    href: "#research",
    cta: "Start exploring",
    background: <HypothesisPreview />,
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
  },
  {
    Icon: GlobeIcon,
    name: "Cross-domain transfer",
    description: "Find structural connections between distant regions of mathematics.",
    href: "#research",
    cta: "Find connections",
    background: null,
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
  },
  {
    Icon: CalendarIcon,
    name: "Research episodes",
    description: "Return to an open problem with its history, memory, and frontier intact.",
    href: "/login",
    cta: "Open workspace",
    background: null,
    className: "lg:col-start-3 lg:col-end-4 lg:row-start-1 lg:row-end-2",
  },
  {
    Icon: BellIcon,
    name: "Formal verification",
    description: "Move promising ideas from candidate argument to checked mathematical result.",
    href: "/login",
    cta: "Enter triviality",
    background: <ProofPreview />,
    className: "lg:col-start-3 lg:col-end-4 lg:row-start-2 lg:row-end-4",
  },
];

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden p-6 text-[10px] text-black/55">
      {children}
    </div>
  );
}

function HypothesisPreview() {
  return (
    <PreviewShell>
      <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/40">
        <span className="rounded border border-black/15 px-2 py-1">frontier</span>
        <span className="text-black/25">/</span>
        <span>4 directions</span>
      </div>
      <div className="mt-6 space-y-3">
        {[
          ["H1", "Weaken assumption", "72%"],
          ["H2", "Invert the structure", "48%"],
          ["H3", "Search counterexample", "31%"],
        ].map(([id, label, score], index) => (
          <div key={id} className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/15 font-mono text-[9px]">
              {id}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between text-[9px]">
                <span className="truncate">{label}</span>
                <span className="font-mono text-black/35">{score}</span>
              </div>
              <div className="h-1 rounded-full bg-black/8">
                <div className="h-1 rounded-full bg-black/45" style={{ width: `${72 - index * 20}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function ProofPreview() {
  return (
    <PreviewShell>
      <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 font-mono text-[9px] leading-5">
        <div className="mb-3 flex items-center gap-1.5 border-b border-black/10 pb-3">
          <span className="h-2 w-2 rounded-full bg-black/20" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="ml-auto text-[8px] text-black/35">Lean 4</span>
        </div>
        <p><span className="text-black/35">01</span> theorem candidate_result :</p>
        <p className="pl-4 text-black/50">invariant preserved → verified</p>
        <p className="mt-2 text-emerald-700">✓ no unsolved goals</p>
      </div>
    </PreviewShell>
  );
}

function GraphPreview() {
  return (
    <PreviewShell>
      <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.16em] text-black/40">
        <span>research graph</span>
        <span className="font-mono text-[8px] text-black/25">02 nodes</span>
      </div>
      <div className="relative mt-3 h-[calc(100%-1.25rem)]">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <marker
              id="graph-arrow"
              markerHeight="5"
              markerWidth="5"
              orient="auto-start-reverse"
              refX="4"
              refY="2.5"
              viewBox="0 0 5 5"
            >
              <path d="M0,0 L5,2.5 L0,5" fill="none" stroke="currentColor" strokeWidth="1" />
            </marker>
          </defs>
          <path d="M25 50 C39 43, 61 43, 75 50" fill="none" markerEnd="url(#graph-arrow)" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.7" />
        </svg>
        <GraphNode className="left-[1%] top-[38%]" detail="claim" label="THEOREM" />
        <GraphNode className="right-[1%] top-[38%]" detail="support" label="LEMMA" />
      </div>
    </PreviewShell>
  );
}

function GraphNode({
  className,
  detail,
  label,
  active = false,
}: {
  className: string;
  detail: string;
  label: string;
  active?: boolean;
}) {
  return (
    <div className={`absolute w-[6.5rem] ${className}`}>
      <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 shadow-[0_5px_18px_rgba(0,0,0,0.06)] ${active ? "border-black bg-black text-white" : "border-black/12 bg-white/90 text-black/75"}`}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${active ? "border-white/70 bg-white" : "border-black/30 bg-white"}`} />
        <span className="min-w-0">
          <span className="block truncate font-mono text-[8px] font-semibold tracking-[0.08em]">{label}</span>
          <span className={`block truncate text-[8px] ${active ? "text-white/55" : "text-black/35"}`}>{detail}</span>
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [msgIdx, setMsgIdx] = useState(0);

  const next = useCallback(
    () => setMsgIdx((index) => (index + 1) % MESSAGES.length),
    [],
  );

  useEffect(() => {
    const id = window.setInterval(next, MESSAGE_INTERVAL);
    return () => window.clearInterval(id);
  }, [next]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-[#111]">
      <CloudShader
        className="pointer-events-none absolute inset-0 h-full w-full"
        cloudColor="#ffffff"
        skyTopColor="#ffffff"
        skyBottomColor="#f3f3ef"
      />

      <nav className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
        <TrivialityLogo />

        <div className="flex items-center gap-6 text-[10px] font-medium uppercase tracking-[0.2em] sm:gap-9">
          <a className="transition-opacity hover:opacity-50" href="#about">
            About
          </a>
          <a className="transition-opacity hover:opacity-50" href="#research">
            Research
          </a>
          <Link
            className="border-b border-black pb-1 transition-opacity hover:opacity-50"
            href="/login"
          >
            Login
          </Link>
        </div>
      </nav>

      <section className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-6 pb-20 pt-8 sm:px-10">
        <div className="w-full max-w-5xl">
          <TextFlippingBoard
            text={MESSAGES[msgIdx]}
            className="!mx-auto !max-w-5xl rounded-none bg-white p-0 shadow-none"
          />
        </div>

        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-[9px] uppercase tracking-[0.3em] text-black/45">
          <span>scroll to wander</span>
          <span className="h-8 w-px bg-black/35" />
        </div>
      </section>

      <section className="relative z-10 bg-white px-6 pb-8 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-6xl">
          <p className="mb-7 text-center text-[10px] font-medium uppercase tracking-[0.3em] text-black/40">
            Built for the research network
          </p>
          <div className="grid grid-cols-2 border-l border-t border-dashed border-black/15 sm:grid-cols-3 lg:grid-cols-5">
            {researchNetwork.map(({ name, logo }, index) => (
              <div
                key={name}
                className="flex h-28 items-center justify-center border-b border-r border-dashed border-black/15 px-4"
              >
                <div className="flex items-center gap-3 text-black/75">
                  <span
                    aria-hidden="true"
                    className="h-8 w-9 shrink-0 bg-contain bg-center bg-no-repeat grayscale"
                    style={{ backgroundImage: `url(${logo})` }}
                  />
                  <span
                    className={`text-xl tracking-[-0.05em] sm:text-2xl ${
                      index % 4 === 1 ? "font-serif" : "font-semibold"
                    }`}
                  >
                    {name}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center pt-10" aria-hidden="true">
            <span className="h-14 w-px bg-black/20" />
          </div>
        </div>
      </section>

      <section id="explore" className="relative z-10 bg-white px-6 pb-24 pt-8 sm:px-10 lg:px-14 lg:pb-32 lg:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.3em] text-black/45">
              Explore triviality
            </p>
            <h2 className="text-4xl font-semibold tracking-[-0.07em] sm:text-6xl">
              A map for the unknown.
            </h2>
          </div>
          <BentoGrid className="lg:grid-rows-3">
            {features.map((feature) => (
              <BentoCard key={feature.name} {...feature} />
            ))}
          </BentoGrid>
        </div>
      </section>

      <div
        aria-hidden="true"
        className="relative z-20 -mb-28 h-28 bg-gradient-to-b from-white via-white/80 to-transparent"
      />

      <section id="research" className="relative z-0 -mt-28 min-h-screen bg-black">
        <ShaderBackground className="h-screen w-full" />
      </section>

      <section id="about" className="relative z-10 border-t border-black/10 bg-white px-6 py-24 sm:px-10 lg:px-14 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-[1.35fr_0.65fr] md:items-end">
            <div>
              <p className="mb-6 text-[10px] font-medium uppercase tracking-[0.3em] text-black/45">
                Keep exploring
              </p>
              <h2 className="max-w-3xl text-5xl font-semibold leading-[0.92] tracking-[-0.08em] sm:text-7xl">
                The next idea is somewhere in the space between.
              </h2>
            </div>
            <div className="flex flex-col items-start gap-7">
              <p className="max-w-xs text-sm leading-6 text-black/55">
                Start with a question. Follow the structure. Leave a trace for
                whatever comes next.
              </p>
              <Link
                href="/login"
                className="group inline-flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.22em]"
              >
                Enter triviality
                <span className="transition-transform duration-300 group-hover:translate-x-2">→</span>
              </Link>
            </div>
          </div>

          <div className="mt-24 flex flex-col justify-between gap-4 border-t border-black/10 pt-5 text-[10px] uppercase tracking-[0.2em] text-black/40 sm:flex-row">
            <span>Triviality / Mathematical discovery system</span>
            <span>© 2026 · Built for the curious</span>
          </div>
        </div>
      </section>
    </main>
  );
}