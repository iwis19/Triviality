export const nodeTypes = ["theorem", "lemma", "definition", "conjecture", "technique", "proof_strategy", "mathematical_structure", "counterexample", "failure", "formalization"] as const;

export const extractionSystemPrompt = `You are a mathematical paper parser. Extract explicit mathematical knowledge objects from the supplied pages. Return strict JSON only with this shape: {"nodes":[{"type":"theorem|lemma|definition|conjecture|technique|proof_strategy|mathematical_structure|counterexample|failure|formalization","title":"short canonical title","statement":"faithful statement, preserving notation in plain text or LaTeX","domain":["topology"],"page":12,"section":"3.2","formalized":false,"confidence":0.96}]}. Only create a node when the paper states or clearly defines it. Do not invent or strengthen claims. Confidence is extraction confidence, not proof correctness. Use the page number supplied by the caller and use an empty section string when unknown.`;

export type ExtractedNode = {
  type: (typeof nodeTypes)[number];
  title: string;
  statement: string;
  domain: string[];
  page: number;
  section: string;
  formalized?: boolean;
  confidence?: number;
};
