import { createHash } from "node:crypto";
import { getCollections, type PaperDocument } from "@triviality/database";

function record(paper: PaperDocument) {
  return { id: paper._id, title: paper.title, abstract: paper.abstract?.slice(0, 2500),
    url: paper.landingUrl ?? paper.openAccessUrl, year: paper.publishedAt?.getFullYear(),
    contentKind: "abstract", source: "literature_bank" };
}

/** Query the existing bank, then add live discovery. Broad sampling is bounded and is reviewed by the coordinator. */
export async function searchLiterature(episodeId: string, query: string, broad = false,
  dependencies = { getCollections, fetch: globalThis.fetch }) {
  const collections = await dependencies.getCollections();
  const words = query.match(/[\p{L}\p{N}]{3,}/gu)?.slice(0, 12) ?? [];
  const expression = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const local = expression ? await collections.papers.find({ $or: [
    { title: { $regex: expression, $options: "i" } }, { abstract: { $regex: expression, $options: "i" } },
  ] }).sort({ citedByCount: -1 }).limit(60).toArray() : [];
  const score = (paper: PaperDocument) => words.filter((word) => `${paper.title} ${paper.abstract ?? ""}`.toLowerCase().includes(word.toLowerCase())).length;
  local.sort((a, b) => score(b) - score(a));
  const random = broad ? await collections.papers.aggregate<PaperDocument>([{ $sample: { size: 4 } }]).toArray() : [];
  const papers = new Map([...local.slice(0, 8), ...random].map((p) => [p._id, record(p)]));
  let warning: string | undefined;
  try {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", query.slice(0, 450));
    url.searchParams.set("per-page", "4");
    const response = await dependencies.fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("OpenAlex unavailable");
    const data = await response.json() as { results?: Array<{ id: string; title?: string; abstract_inverted_index?: Record<string, number[]>; publication_year?: number; cited_by_count?: number; primary_location?: { landing_page_url?: string } }> };
    for (const work of data.results ?? []) {
      if (!work.id || !work.title) continue;
      const abstract: string[] = [];
      for (const [word, positions] of Object.entries(work.abstract_inverted_index ?? {})) for (const pos of positions) if (pos < 20000) abstract[pos] = word;
      const paperId = `paper_${createHash("sha1").update(work.id).digest("hex").slice(0, 16)}`;
      const now = new Date();
      await collections.papers.updateOne({ _id: paperId }, { $set: { externalId: work.id, title: work.title,
        abstract: abstract.filter(Boolean).join(" "), landingUrl: work.primary_location?.landing_page_url ?? work.id,
        citedByCount: work.cited_by_count ?? 0, updatedAt: now },
        $setOnInsert: { createdAt: now, authors: [], subjects: [] } }, { upsert: true });
      const paper = await collections.papers.findOne({ _id: paperId });
      if (paper) papers.set(paperId, record(paper));
    }
  } catch { warning = "Live search unavailable; using the existing literature bank."; }
  const ids = [...papers.keys()];
  // Dotted updates preserve ingestion metadata and link all retrieved sources to this episode.
  if (ids.length) await collections.papers.updateMany({ _id: { $in: ids } }, {
    $addToSet: { "rawMetadata.episodeIds": episodeId }, $set: { updatedAt: new Date() },
  });
  const knowledge = ids.length ? await collections.paperNodes.find({ "source.paper_id": { $in: ids } }).limit(80).toArray() : [];
  return { papers: [...papers.values()].map((paper) => ({ ...paper,
    extractedKnowledge: knowledge.filter((node) => node.source.paper_id === paper.id).slice(0, 4).map((node) => ({
      id: node._id, type: node.type, statement: node.statement.slice(0, 2000), location: node.source.location,
      status: node.metadata.formalized ? "formalization_recorded" : "extracted_unverified",
    })),
  })), warning };
}
