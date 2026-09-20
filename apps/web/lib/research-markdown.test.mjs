import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { normalizeResearchMath, latexArtifactMarkdown } from "./research-markdown.ts";

function render(source) {
  return renderToStaticMarkup(React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex],
  }, normalizeResearchMath(source)));
}

test("renders dollar and TeX inline/display delimiters through KaTeX", () => {
  for (const source of [String.raw`$x^2$`, String.raw`$$x^2$$`, String.raw`\(x^2\)`, String.raw`Before \[x^2\] after`]) {
    const html = render(source);
    assert.match(html, /class="katex"/);
    assert.doesNotMatch(html, /katex-error/);
  }
  assert.match(render(String.raw`\[x^2\]`), /katex-display/);
});

test("preserves code, escaped delimiters, and existing math verbatim", () => {
  for (const source of [
    '`\\(x\\)`', '`` ` \\(x\\) ``',
    '```lean\n\\[x\\]\n```', '~~~tex\n\\(x\\)\n~~~',
    '    \\(x\\)\n', String.raw`\\(literal\\)`,
    String.raw`$\text{use \( literally}$`,
  ]) assert.equal(normalizeResearchMath(source), source);
});

test("renders equation and alignment environments", () => {
  for (const source of [
    String.raw`\begin{equation}a=b\end{equation}`,
    String.raw`\begin{align*}a &= b \\ c &= d\end{align*}`,
  ]) {
    assert.match(render(source), /katex-display/);
    assert.doesNotMatch(render(source), /katex-error/);
  }
});

test("previews saved TeX when there is no Markdown exposition", () => {
  const source = String.raw`\documentclass{article}
\begin{document}
\section{Result}
\begin{proof}We have \(x^2\) and
\begin{align}a &= b \\ c &= d\end{align}
\end{proof}
\end{document}`;
  const html = render(latexArtifactMarkdown(source));
  assert.match(html, /<h2>Result<\/h2>/);
  assert.match(html, /katex-display/);
  assert.doesNotMatch(html, /documentclass|katex-error/);
  assert.equal(latexArtifactMarkdown(""), "");
});

test("malformed math remains visible and HTML is not executed", () => {
  assert.match(render(String.raw`$\frac{x}{$`), /katex-error/);
  assert.doesNotMatch(render('<script>alert(1)</script>'), /<script>/);
});

test("formats the reported addition proof and keeps the equation inside its list item", () => {
  const source = '- **Base case (****`c = 0`****)**: The goal is `a + 0 ≤ b + 0`.\n'
    + '- **Inductive step**: Assume `ih : a + c ≤ b + c`. Monotonicity gives '
    + String.raw`[ \operatorname{succ}(a+c) \le \operatorname{succ}(b+c). ] By `
    + '`Nat.add_succ`, the next case follows.';
  const html = render(source);
  assert.match(html, /<strong>Base case \(<code>c = 0<\/code>\)<\/strong>/);
  assert.doesNotMatch(html, /\*\*|katex-error/);
  assert.match(html, /<li>[\s\S]*Inductive step[\s\S]*katex-display[\s\S]*Nat.add_succ[\s\S]*<\/li>/);
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.equal(normalizeResearchMath(normalizeResearchMath(source)), normalizeResearchMath(source));
});

test("does not reinterpret bracketed prose, links, or code as damaged math", () => {
  for (const source of [
    '[an ordinary note]', '[0, 1]', String.raw`[\operatorname{succ}](https://example.com)`,
    '`[ \\operatorname{succ}(x) ]`', '```text\n**Base (****`x`****)**\n```',
  ]) assert.equal(normalizeResearchMath(source), source);
});
