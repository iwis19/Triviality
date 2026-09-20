import type { Metadata } from "next";
import { LiteratureReader } from "@/components/literature-reader";
import { trihexagonalShellProof } from "@/lib/published-proofs";

export const metadata: Metadata = {
  title: "Trihexagonal shell counterexample | Triviality",
  description: "A Lean-checked 23-cell shell enclosing a connected 31-cell hole, disproving the proposed trihexagonal-shell capacity bound.",
};

export default function TrihexagonalShellProofPage() {
  return <LiteratureReader paper={trihexagonalShellProof} />;
}
