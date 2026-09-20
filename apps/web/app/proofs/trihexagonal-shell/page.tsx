import type { Metadata } from "next";
import { DashboardSidebar } from "@/app/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/app/dashboard/dashboard-topbar";
import { LiteratureReader } from "@/components/literature-reader";
import { trihexagonalShellProof } from "@/lib/published-proofs";

export const metadata: Metadata = {
  title: "Trihexagonal shell counterexample | Triviality",
  description: "A Lean-checked 23-cell shell enclosing a connected 31-cell hole, disproving the proposed trihexagonal-shell capacity bound.",
};

export default function TrihexagonalShellProofPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#f5f5f5] text-[#111] md:flex-row">
      <DashboardSidebar />
      <div className="min-w-0 flex-1">
        <DashboardTopbar page="Research" />
        <LiteratureReader paper={trihexagonalShellProof} workspace />
      </div>
    </main>
  );
}
