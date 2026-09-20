import { ResearchMarkdown } from "@/components/research-markdown";
import type { ResearchLiterature } from "@/lib/research-store";

export function ResearchLiteratureDocument({ paper }: { paper: ResearchLiterature }) {
  const markdown = paperMarkdown(paper);

  return (
    <div className="grid min-h-[38rem] overflow-hidden rounded-2xl border border-black/10 lg:grid-cols-2">
      <section className="min-h-0 bg-[#111] lg:overflow-y-auto" aria-label="Markdown source">
        <div className="border-b border-white/10 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">source.md</div>
        <pre className="overflow-x-auto p-5 text-xs leading-6 text-white/75 sm:p-7"><code>{markdown}</code></pre>
      </section>
      <section className="min-h-0 overflow-y-auto bg-white p-5 sm:p-9" aria-label="Rendered Markdown">
        <div className="mb-7 flex items-center justify-between border-b border-black/10 pb-4"><span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/40">Rendered output</span><span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35">Markdown + KaTeX</span></div>
        <div className="literature-markdown max-w-2xl">
          <ResearchMarkdown
            components={{
              h1: ({ children }) => <h2 className="text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">{children}</h2>,
              h2: ({ children }) => <h3 className="mt-10 text-xl font-semibold tracking-[-0.04em]">{children}</h3>,
              p: ({ children }) => <p className="mt-5 text-[15px] leading-8 text-black/65 sm:text-base">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-black">{children}</strong>,
              blockquote: ({ children }) => <blockquote className="mt-6 border-l-2 border-black/20 pl-4 text-[15px] leading-7 text-black/60">{children}</blockquote>,
              ul: ({ children }) => <ul className="mt-5 list-disc space-y-2 pl-5 text-[15px] leading-7 text-black/65">{children}</ul>,
              code: ({ children }) => <code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[0.86em]">{children}</code>,
            }}
          >{markdown}</ResearchMarkdown>
        </div>
      </section>
    </div>
  );
}

function paperMarkdown(paper: ResearchLiterature) {
  return `# ${paper.title}

*${paper.authors} · ${paper.year}*

${paper.summary}

## Relevance

${paper.relevance}

## Source

[${paper.source}](${paper.url})`;
}
