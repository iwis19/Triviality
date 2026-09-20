"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResearchMarkdown } from "@/components/research-markdown";
import { IconArrowLeft, IconArrowUpRight, IconCopy, IconCheck } from "@tabler/icons-react";
import { TrivialityLogo } from "@/components/triviality-logo";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import type { LiteraturePaper } from "@/lib/literature";

export function LiteratureReader({ paper, workspace = false }: { paper: LiteraturePaper; workspace?: boolean }) {
  const [activeSection, setActiveSection] = useState(paper.sections[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const sectionIds = useMemo(() => paper.sections.map((section) => section.id), [paper.sections]);

  useEffect(() => {
    const headings = sectionIds
      .map((id) => document.getElementById(id))
      .filter((heading): heading is HTMLElement => Boolean(heading));
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-12% 0px -72% 0px", threshold: [0, 1] },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [sectionIds]);

  const copyPage = async () => {
    const text = [paper.title, ...paper.sections.map((section) => `${section.title}\n${section.markdown}`)].join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={workspace ? "text-[#171717]" : "min-h-screen bg-white text-[#171717]"}>
      {!workspace && <ReaderNav />}

      <div className={workspace ? "mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-14" : "mx-auto max-w-[1200px] px-5 pb-16 pt-8 sm:px-10 lg:px-16 lg:pt-12"}>
        {workspace && <Link className="mb-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 hover:text-black" href="/dashboard"><IconArrowLeft size={14} /> Overview</Link>}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-16">
          <article className="min-w-0">
            <header className="mx-auto max-w-[820px]">
              {workspace ? <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-medium uppercase tracking-[0.2em] text-black/45"><span className="rounded-full bg-black px-2.5 py-1 text-white">completed</span></div> : <div className="flex items-center gap-3 text-sm font-medium text-black/60 sm:text-base"><time>{paper.date}</time><span className="text-black/20">·</span><span>{paper.category}</span></div>}
              <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl"><ResearchMarkdown inline>{paper.title}</ResearchMarkdown></h1>
              {workspace ? <p className="mt-5 max-w-3xl text-base leading-7 text-black/55">{paper.subtitle}</p> : <p className="mt-5 text-xs text-black/55"><span className="text-black/75">{paper.authors}</span>{paper.source ? ` · ${paper.source}` : ""}</p>}
              {paper.verification && <div className="mt-6 rounded-2xl border border-emerald-900/15 bg-emerald-50/60 px-5 py-4"><p className="text-sm font-semibold text-emerald-950">{paper.verification.label}</p><p className="mt-1 text-xs leading-5 text-emerald-950/65">{paper.verification.detail}</p></div>}
              {paper.artifacts && paper.artifacts.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{paper.artifacts.map((artifact) => <a className="rounded-full border border-black/15 px-4 py-2 text-xs font-medium transition hover:border-black/35 hover:bg-black/[.025]" href={artifact.href} key={artifact.href}>{artifact.label}</a>)}</div>}
            </header>

            <div className="mx-auto mt-12 max-w-[820px] text-left">
              {paper.sections.map((section) => (
                <section className="literature-section literature-markdown scroll-mt-28" id={section.id} key={section.id}>
                  <ResearchMarkdown
                    components={{
                      h1: ({ children }) => <h2 className="mt-14 text-2xl font-semibold tracking-[-0.05em] first:mt-0 sm:text-3xl">{children}</h2>,
                      h2: ({ children }) => <h2 className="mt-14 text-2xl font-semibold tracking-[-0.05em] first:mt-0 sm:text-3xl">{children}</h2>,
                      h3: ({ children }) => <h3 className="mt-9 text-xl font-semibold tracking-[-0.04em]">{children}</h3>,
                      p: ({ children }) => <p className="mt-5 text-[15px] leading-7 text-black/75 sm:text-base sm:leading-8">{children}</p>,
                      blockquote: ({ children }) => <blockquote className="mt-7 border-l-2 border-black/20 pl-5 text-[15px] leading-7 text-black/65 sm:text-base sm:leading-8">{children}</blockquote>,
                      strong: ({ children }) => <strong className="font-semibold text-black">{children}</strong>,
                      a: ({ children, href }) => <a className="underline decoration-black/25 underline-offset-4 hover:decoration-black" href={href}>{children}</a>,
                      ul: ({ children }) => <ul className="mt-5 list-disc space-y-2 pl-6 text-[15px] leading-7 text-black/75 sm:text-base sm:leading-8">{children}</ul>,
                      ol: ({ children }) => <ol className="mt-5 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-black/75 sm:text-base sm:leading-8">{children}</ol>,
                      code: ({ children }) => <code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[0.86em]">{children}</code>,
                      pre: ({ children }) => <pre className="mt-6 max-h-[38rem] overflow-auto rounded-xl border border-black/10 bg-[#f7f7f5] p-5 text-xs leading-6">{children}</pre>,
                    }}
                  >{`## ${section.title}\n\n${section.markdown}`}</ResearchMarkdown>
                </section>
              ))}
            </div>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-28 border-l-2 border-black/10 pl-7">
              <p className="text-sm font-medium text-black/70">On this page</p>
              <nav className="mt-5 grid gap-4">
                {paper.sections.map((section) => (
                  <a className={`text-sm transition ${activeSection === section.id ? "font-medium text-black" : "text-black/40 hover:text-black/75"}`} href={`#${section.id}`} key={section.id}>{section.title}</a>
                ))}
              </nav>
              <button className="mt-8 inline-flex items-center gap-2 rounded-xl border border-black/15 px-4 py-2.5 text-sm font-medium transition hover:border-black/35 hover:bg-black/[.025]" onClick={copyPage} type="button">
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                {copied ? "Copied" : "Copy page"}
              </button>
            </div>
          </aside>
        </div>
      </div>

    </div>
  );
}

function ReaderNav() {
  return (
    <nav className="border-b border-black/[.07] bg-white" aria-label="Literature navigation">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-10 lg:px-16">
        <div className="flex items-center gap-4 sm:gap-8">
          <TrivialityLogo className="scale-[0.92] origin-left" />
          <Link className="text-sm text-black/75 sm:text-[15px]" href="/">Home</Link>
        </div>
        <div className="flex items-center gap-3">
          <HoverBorderGradient as={Link} href="/dashboard" containerClassName="rounded-full" className="flex items-center gap-1 rounded-[inherit] bg-black px-5 py-2.5 text-sm font-medium text-white" duration={1.2}>Back to workspace <IconArrowUpRight size={15} /></HoverBorderGradient>
        </div>
      </div>
    </nav>
  );
}
