export type MathArea = {
  slug: string;
  label: string;
  query: string;
};

// OpenAlex search is used deliberately here because it provides citation-ranked
// works. The catalog is configurable/extendable without changing the worker.
export const mathAreas: MathArea[] = [
  { slug: "algebra", label: "Algebra", query: "algebra" },
  { slug: "analysis", label: "Analysis", query: "mathematical analysis" },
  { slug: "geometry", label: "Geometry", query: "mathematical geometry" },
  { slug: "topology", label: "Topology", query: "mathematical topology" },
  { slug: "number_theory", label: "Number Theory", query: "number theory" },
  { slug: "combinatorics", label: "Combinatorics", query: "combinatorics" },
  { slug: "probability", label: "Probability", query: "mathematical probability" },
  { slug: "statistics", label: "Statistics", query: "mathematical statistics" },
  { slug: "logic", label: "Logic", query: "mathematical logic" },
  { slug: "differential_equations", label: "Differential Equations", query: "differential equations" },
  { slug: "numerical_analysis", label: "Numerical Analysis", query: "numerical analysis" },
  { slug: "optimization", label: "Optimization", query: "mathematical optimization" },
  { slug: "dynamical_systems", label: "Dynamical Systems", query: "dynamical systems" },
  { slug: "mathematical_physics", label: "Mathematical Physics", query: "mathematical physics" },
  { slug: "category_theory", label: "Category Theory", query: "category theory" },
  { slug: "representation_theory", label: "Representation Theory", query: "representation theory" },
];
