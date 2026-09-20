"use client";

export function DashboardTopbar({ page }: { page: string }) {
  return (
    <nav className="sticky top-0 z-20 flex h-14 md:h-[var(--workspace-header-height)] w-full items-center justify-between border-b border-black/10 bg-white px-6 backdrop-blur sm:px-10 lg:px-14" aria-label="Dashboard navigation">
      <span className="text-sm font-semibold tracking-[-0.02em]">{page}</span>
    </nav>
  );
}
