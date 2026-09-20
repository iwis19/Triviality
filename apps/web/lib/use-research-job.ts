"use client";

import { useEffect, useState } from "react";
import { getResearchJob, type ResearchJob } from "./research-store";

// Keep recently opened chats available during client-side navigation.
const recentJobs = new Map<string, ResearchJob>();

export function useResearchJob(id: string) {
  const [loaded, setLoaded] = useState<ResearchJob | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const next = await getResearchJob(id);
        if (cancelled) return;
        recentJobs.delete(id);
        recentJobs.set(id, next);
        if (recentJobs.size > 20) recentJobs.delete(recentJobs.keys().next().value!);
        setLoaded(next);
        setFailure(null);
        // A finished result needs no continuous polling. Revalidate on revisits.
        if (next.status === "running") timer = setTimeout(refresh, 1500);
      } catch (reason) {
        if (cancelled) return;
        setFailure({ id, message: reason instanceof Error ? reason.message : "Could not load research." });
        timer = setTimeout(refresh, 3000);
      }
    };
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  return {
    job: loaded?.id === id ? loaded : recentJobs.get(id) ?? null,
    error: failure?.id === id ? failure.message : null,
  };
}
