export type OpenAlexWork = {
  id: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  cited_by_count?: number;
  topics?: Array<{ display_name?: string | null }>;
  concepts?: Array<{ display_name?: string | null }>;
  authorships?: Array<{ author?: { display_name?: string | null } | null }>;
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_location?: { landing_page_url?: string | null; pdf_url?: string | null } | null;
  open_access?: { oa_url?: string | null } | null;
};

export type OpenAlexResponse = {
  results: OpenAlexWork[];
  meta?: { count?: number };
};

export type EmbeddingProvider = {
  model: string;
  embed(input: string): Promise<number[] | null>;
};
