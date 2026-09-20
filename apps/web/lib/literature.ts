export type LiteratureSection = {
  id: string;
  title: string;
  markdown: string;
};

export type LiteraturePaper = {
  id: string;
  href?: string;
  date: string;
  category: string;
  title: string;
  subtitle: string;
  authors: string;
  source: string;
  verification?: {
    label: string;
    detail: string;
  };
  artifacts?: Array<{
    label: string;
    href: string;
  }>;
  sections: LiteratureSection[];
};
