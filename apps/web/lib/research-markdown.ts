// Protect Markdown code and existing math before normalizing TeX delimiters.
const tokens = /(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\2[^\n]*(?:\n|$)|(`+)[^`]*?\3|^ {4}[^\n]*(?:\n|$))|(?<!\\)(\$\$[\s\S]*?(?<!\\)\$\$|\$[^\n$]+?(?<!\\)\$)|(?<!\\)\\\(([\s\S]*?)\\\)|(?<!\\)\\\[([\s\S]*?)\\\]|\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]*?)\\end\{\7\}/gm;

export function normalizeResearchMath(source: string): string {
  const normalized = source.replace(tokens, (match, code, _fence, _ticks, dollars, inline, display, environment, body, offset) => {
    if (code || dollars) return match;
    if (inline !== undefined) return `$${inline.trim().replace(/\s*\n\s*/g, " ")}$`;
    if (display !== undefined) return displayMath(source, offset, display.trim());
    const name = environment.replace(/\*$/, "");
    const wrapper = name === "align" ? "aligned" : name === "gather" || name === "multline" ? "gathered" : null;
    return displayMath(source, offset, wrapper ? `\\begin{${wrapper}}${body}\\end{${wrapper}}` : body.trim());
  });
  // Some saved explanations have already lost the slashes on \[ ... \].
  // Recover only brackets containing a known TeX math command, never links,
  // ordinary bracketed prose, code, or already-delimited mathematics.
  const protectedTokens: string[] = [];
  const prose = normalized.replace(tokens, (match) => {
    protectedTokens.push(match);
    return `\u0000TOKEN${protectedTokens.length - 1}\u0000`;
  });
  return prose
    .replace(/(?<![\\!])\[([^\[\]\n]*\\(?:operatorname|frac|sum|prod|int|sqrt|leq?|geq?|infty|alpha|beta)\b[^\[\]\n]*)\](?![\w(\[:])/g,
      (match, body, offset) => displayMath(prose, offset, body.trim()))
    // Adjacent bold spans surrounding inline code can arrive as four stars.
    .replace(/(\*\*[^*\n]+)\*{4}(\u0000TOKEN\d+\u0000)\*{4}([^*\n]*\*\*)/g, "$1$2$3")
    .replace(/\u0000TOKEN(\d+)\u0000/g, (_, index) => protectedTokens[Number(index)]);
}

function displayMath(source: string, offset: number, body: string): string {
  const line = source.slice(source.lastIndexOf("\n", offset - 1) + 1, offset);
  const list = line.match(/^(\s*)(?:[-+*]|\d+\.)\s+/);
  const indent = list ? " ".repeat(list[0].length) : line.match(/^\s*/)?.[0] ?? "";
  return `\n\n${indent}$$\n${body.split("\n").map((line) => indent + line).join("\n")}\n${indent}$$\n\n${indent}`;
}

// A readable preview of standard generated TeX documents; the original remains
// available in the source view/download. This does not execute TeX packages.
export function latexArtifactMarkdown(source: string): string {
  const document = source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/)?.[1] ?? source;
  const math: string[] = [];
  const normalized = normalizeResearchMath(document).replace(tokens, (match) => {
    math.push(match);
    return `\u0000MATH${math.length - 1}\u0000`;
  });
  return normalized
    .replace(/\\(?:sub)*section\*?\{([^{}]*)\}/g, "\n\n## $1\n\n")
    .replace(/\\(?:textbf|emph|textit)\{([^{}]*)\}/g, "$1")
    .replace(/\\begin\{(theorem|lemma|proposition|corollary|proof|abstract)\}(?:\[([^\]]*)\])?/g, (_, name, title) => `\n\n**${title ?? name}.**\n\n`)
    .replace(/\\end\{(?:theorem|lemma|proposition|corollary|proof|abstract)\}/g, "\n\n")
    .replace(/\\(?:begin|end)\{(?:itemize|enumerate)\}/g, "\n")
    .replace(/\\item\s*/g, "\n- ")
    .replace(/\\(?:maketitle|newpage|noindent)\b/g, "")
    .replace(/\u0000MATH(\d+)\u0000/g, (_, index) => math[Number(index)]);
}
