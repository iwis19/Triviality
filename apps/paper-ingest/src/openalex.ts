import { config } from "./config.js";
import { mathAreas, type MathArea } from "./math-areas.js";
import type { OpenAlexResponse, OpenAlexWork } from "./types.js";

export type AreaPaperBatch = { area: MathArea; works: OpenAlexWork[] };

export async function fetchTopPapersForArea(area: MathArea): Promise<OpenAlexWork[]> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", area.query);
  url.searchParams.set("filter", config.openAlexFilter);
  url.searchParams.set("sort", "cited_by_count:desc");
  url.searchParams.set("per-page", String(config.openAlexPerPage));
  if (config.openAlexEmail) url.searchParams.set("mailto", config.openAlexEmail);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenAlex request failed: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as OpenAlexResponse;
  return payload.results;
}

export async function fetchTopMathPapersByArea(): Promise<AreaPaperBatch[]> {
  const areas = config.openAlexAreaLimit > 0 ? mathAreas.slice(0, config.openAlexAreaLimit) : mathAreas;
  const batches: AreaPaperBatch[] = [];
  for (const area of areas) {
    const works = await fetchTopPapersForArea(area);
    batches.push({ area, works });
    if (config.openAlexRequestDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.openAlexRequestDelayMs));
  }
  return batches;
}

export function abstractFromInvertedIndex(index: OpenAlexWork["abstract_inverted_index"]): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return words.filter(Boolean).join(" ") || null;
}

export function paperSourceUrl(work: OpenAlexWork): string {
  return work.primary_location?.landing_page_url ?? `https://openalex.org/${work.id.split("/").pop()}`;
}
