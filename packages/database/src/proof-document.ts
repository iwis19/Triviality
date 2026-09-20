/** Export prose with dollar-delimited LaTeX math as a standalone document. */
export function proofDocument(title: string, statement: string, explanation: string, checker: string): string {
  const escape = (text: string) => text.replace(/[\\{}$&#%_^~]/g, (character) => ({
    "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "$": "\\$", "&": "\\&",
    "#": "\\#", "%": "\\%", "_": "\\_", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}",
  })[character]!);
  const prose = (text: string) => text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map((part, index) =>
    index % 2 ? part : escape(part.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1"))).join("");
  return ["\\documentclass{article}", "\\usepackage{amsmath,amssymb}", "\\usepackage[margin=1in]{geometry}",
    "% Compile with LuaLaTeX for Unicode text.", "\\usepackage{fontspec}", "\\usepackage{unicode-math}",
    `\\title{${escape(title)}}`, "\\date{}", "\\begin{document}", "\\maketitle",
    "\\section*{Research question}", prose(statement), "\\section*{Proof exposition}",
    prose(explanation || "No written proof explanation was saved for this episode."),
    "\\section*{Verification scope}", prose(checker),
    "The checker result applies to the Lean source. This written exposition is not independently machine-checked.",
    "\\end{document}", ""].join("\n\n");
}
