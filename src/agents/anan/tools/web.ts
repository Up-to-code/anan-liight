export interface WebSearchInput {
  query: string;
  num?: number;
}

export interface WebSearchResult {
  snippets: Array<{ title: string; snippet: string }>;
}

interface WebSnippetSeed {
  title: string;
  snippet: string;
  tags: string[];
}

const SNIPPETS: WebSnippetSeed[] = [
  {
    title: "Saudi mortgage trends 2026",
    snippet: "Current mortgage demand in Saudi Arabia is shifting toward fixed-rate products with stronger first-home incentives.",
    tags: ["saudi", "mortgage", "rates", "loan", "2026"]
  },
  {
    title: "Dubai residential market snapshot",
    snippet: "Dubai continues to show resilient demand in mid-market apartments, with strong absorption in Marina and Downtown.",
    tags: ["dubai", "market", "apartments", "residential"]
  },
  {
    title: "UAE regulations update for real estate buyers",
    snippet: "Recent compliance updates emphasize disclosure quality, escrow controls, and clearer transaction timelines.",
    tags: ["uae", "regulations", "buyers", "compliance"]
  },
  {
    title: "Riyadh neighborhood guide for families",
    snippet: "Key family-focused districts in Riyadh balance school access, commute, and long-term pricing stability.",
    tags: ["riyadh", "neighborhood", "families", "guide"]
  },
  {
    title: "Jeddah apartment demand report",
    snippet: "Jeddah demand remains concentrated in well-connected zones with value-focused 2-3 bedroom inventory.",
    tags: ["jeddah", "apartments", "demand", "report"]
  },
  {
    title: "How to compare home financing bundles",
    snippet: "Compare APR, profit rate structure, processing fees, and early-settlement terms before selecting a bank bundle.",
    tags: ["finance", "loan", "apr", "bank", "bundle"]
  }
];

function scoreSnippet(seed: WebSnippetSeed, tokens: string[]): number {
  const haystack = `${seed.title} ${seed.snippet} ${seed.tags.join(" ")}`.toLowerCase();
  return tokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

export async function searchWebInfo(input: WebSearchInput): Promise<WebSearchResult> {
  const limit = Math.max(1, Math.min(input.num ?? 6, 10));
  const tokens = tokenize(input.query);

  const ranked = [...SNIPPETS]
    .map((seed) => ({ seed, score: scoreSnippet(seed, tokens) }))
    .sort((a, b) => b.score - a.score || a.seed.title.localeCompare(b.seed.title))
    .slice(0, limit)
    .map(({ seed }) => ({ title: seed.title, snippet: seed.snippet }));

  return { snippets: ranked };
}
