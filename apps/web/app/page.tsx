"use client";

import React from "react";
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

const features = [
  {
    Icon: FileTextIcon,
    name: "Research graph",
    description: "See connections between problems, papers, and proofs.",
    href: "/dashboard/graph",
    cta: "View graph",
    background: <GraphPreview />,
    className: "lg:col-start-2 lg:col-end-3 lg:row-start-1 lg:row-end-4",
  },
  {
    Icon: InputIcon,
    name: "Hypotheses",
    description: "Compare approaches and review their results.",
    href: "/dashboard",
    cta: "View research",
    background: <HypothesisPreview />,
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
  },
  {
    Icon: GlobeIcon,
    name: "Literature",
    description: "Read the papers attached to your research.",
    href: "/dashboard/literature",
    cta: "View literature",
    background: null,
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
  },
  {
    Icon: CalendarIcon,
    name: "Research history",
    description: "Revisit previous problems and attempts.",
    href: "/dashboard",
    cta: "Open workspace",
    background: null,
    className: "lg:col-start-3 lg:col-end-4 lg:row-start-1 lg:row-end-2",
  },
  {
    Icon: BellIcon,
    name: "Formal verification",
    description: "Check proof candidates with Lean.",
    href: "/dashboard",
    cta: "Start research",
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
      <div className="mt-6 space-y-5">
        {[72, 48, 31].map((width) => (
          <div key={width} className="flex items-center gap-3">
            <span className="h-6 w-6 rounded-full border border-black/15" />
            <div className="h-1 flex-1 rounded-full bg-black/8">
              <div className="h-1 rounded-full bg-black/45" style={{ width: `${width}%` }} />
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
      <div className="space-y-3 rounded-lg border border-black/10 bg-black/[0.025] p-4">
        {[80, 55, 65, 40].map((width) => (
          <div key={width} className="h-1.5 rounded bg-black/15" style={{ width: `${width}%` }} />
        ))}
      </div>
    </PreviewShell>
  );
}

function GraphPreview() {
  return (
    <PreviewShell>
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

        <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.2em] sm:gap-9">
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
            text="TRIVIALITY"
            className="!mx-auto !max-w-5xl rounded-none bg-white p-0 shadow-none"
          />
        </div>

        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-[9px] uppercase tracking-[0.3em] text-black/45">
          <span className="h-8 w-px bg-black/35" />
        </div>
      </section>

      <section id="research" className="relative z-10 bg-white px-6 pb-24 pt-8 sm:px-10 lg:px-14 lg:pb-32 lg:pt-10">
        <div className="mx-auto max-w-6xl">
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

      <section aria-label="Animated background" className="relative z-0 -mt-28 min-h-screen bg-black">
        <ShaderBackground className="h-screen w-full" />
      </section>

      <section id="about" className="relative z-10 border-t border-black/10 bg-white px-6 py-24 sm:px-10 lg:px-14 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-[1.35fr_0.65fr] md:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                Mathematical research
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-black/55">
                Review hypotheses, related papers, and Lean proof checks in one workspace.
              </p>
            </div>
            <div className="flex flex-col items-start gap-7">
              <Link
                href="/login"
                className="group inline-flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.22em]"
              >
                Open workspace
                <span className="transition-transform duration-300 group-hover:translate-x-2">→</span>
              </Link>
            </div>
          </div>

          <div className="mt-24 flex flex-col justify-between gap-4 border-t border-black/10 pt-5 text-[10px] uppercase tracking-[0.2em] text-black/40 sm:flex-row">
            <span>Triviality</span>
            <span>© 2026 Triviality</span>
          </div>
        </div>
      </section>
    </main>
  );
}
