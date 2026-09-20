import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { normalizeResearchMath } from "@/lib/research-markdown";

const proseComponents: Components = {
  p: ({ children }) => <p className="my-4 leading-8 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <h2 className="mb-4 mt-8 text-2xl font-semibold">{children}</h2>,
  h2: ({ children }) => <h3 className="mb-3 mt-7 text-xl font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-3 mt-6 text-lg font-semibold">{children}</h4>,
  h4: ({ children }) => <h5 className="mb-2 mt-5 font-semibold">{children}</h5>,
  ul: ({ children }) => <ul className="my-5 list-disc space-y-4 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-5 list-decimal space-y-4 pl-6">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-black">{children}</strong>,
  code: ({ children }) => <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="my-5 overflow-x-auto rounded-lg bg-black/5 p-4 text-xs leading-6">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="my-5 border-l-2 border-black/20 pl-4">{children}</blockquote>,
  a: ({ children, href }) => <a href={href} className="underline underline-offset-4">{children}</a>,
};

export function ResearchMarkdown({ children, components, inline = false }: {
  children: string;
  components?: Components;
  inline?: boolean;
}) {
  return <ReactMarkdown
    remarkPlugins={[remarkMath]}
    rehypePlugins={[[rehypeKatex, { strict: false, trust: false }]]}
    components={inline ? { ...components, p: ({ children }) => <span>{children}</span>, a: ({ children }) => <span>{children}</span> } : { ...proseComponents, ...components }}
  >{normalizeResearchMath(children)}</ReactMarkdown>;
}
