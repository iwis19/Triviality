import { DashboardSidebar } from "../dashboard-sidebar";
import { DashboardTopbar } from "../dashboard-topbar";

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-[#f5f5f5] text-[#111] md:flex-row">
      <DashboardSidebar />
      <div className="min-w-0 flex-1">
        <DashboardTopbar page="Research chats" />
        {children}
      </div>
    </main>
  );
}
