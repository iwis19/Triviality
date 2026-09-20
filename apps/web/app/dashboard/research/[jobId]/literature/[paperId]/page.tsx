"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LiteratureReader } from "@/components/literature-reader";
import type { LiteraturePaper } from "@/lib/literature";
import { getResearchJob, type ResearchJob } from "@/lib/research-store";

export default function ResearchLiteraturePage() {
  const params = useParams<{ jobId: string; paperId: string }>();
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getResearchJob(params.jobId).then(setJob).catch((reason: Error) => setError(reason.message));
  }, [params.jobId]);

  if (!job) {
    return <main className="flex min-h-screen items-center justify-center bg-white text-sm text-black/55">{error ?? "Loading paper…"}</main>;
  }

  const paper = job.literature.find((item) => item.id === decodeURIComponent(params.paperId));

  if (!paper) {
    return <main className="flex min-h-screen items-center justify-center bg-white text-sm text-black/55">Paper not found.</main>;
  }

  const blogPaper: LiteraturePaper = {
    id: paper.id,
    href: `/dashboard/research/${encodeURIComponent(job.id)}`,
    date: paper.year,
    category: paper.source,
    title: paper.title,
    subtitle: paper.summary,
    authors: paper.authors,
    source: paper.source,
    sections: [
      {
        id: "abstract",
        title: "Abstract",
        markdown: paper.summary,
      },
      {
        id: "research-connection",
        title: "Research connection",
        markdown: paper.relevance,
      },
      {
        id: "source",
        title: "Source",
        markdown: `[${paper.source}](${paper.url})`,
      },
    ],
  };

  return <LiteratureReader paper={blogPaper} />;
}
