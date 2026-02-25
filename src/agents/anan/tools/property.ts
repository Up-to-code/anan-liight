export interface PropertySearchInput {
  query: string;
  location?: string;
  budget?: number;
  bedrooms?: number;
  excludeUrls?: string[];
}

export interface PropertySearchResult {
  items: Array<{
    title: string;
    propertyUrl: string;
    location?: string;
    price?: string;
    imageUrls?: string[];
  }>;
}

interface SeedProperty {
  title: string;
  propertyUrl: string;
  location: string;
  bedrooms: number;
  priceValue: number;
  priceLabel: string;
  imageUrls: string[];
}

const SEED_PROPERTIES: SeedProperty[] = [
  {
    title: "شقة 3 غرف في الرياض - الياسمين",
    propertyUrl: "https://listings.example.sa/riyadh-yasmeen-3br-1001",
    location: "Riyadh",
    bedrooms: 3,
    priceValue: 1280000,
    priceLabel: "1,280,000 SAR",
    imageUrls: ["https://images.example.sa/p1001/1.jpg", "https://images.example.sa/p1001/2.jpg"]
  },
  {
    title: "Modern 2BR apartment in Jeddah",
    propertyUrl: "https://homes.example.sa/jeddah-2br-1002",
    location: "Jeddah",
    bedrooms: 2,
    priceValue: 860000,
    priceLabel: "860,000 SAR",
    imageUrls: ["https://images.example.sa/p1002/1.jpg"]
  },
  {
    title: "Villa 4BR in Dammam - Al Faisaliyah",
    propertyUrl: "https://market.example.sa/dammam-villa-4br-1003",
    location: "Dammam",
    bedrooms: 4,
    priceValue: 1750000,
    priceLabel: "1,750,000 SAR",
    imageUrls: ["https://images.example.sa/p1003/1.jpg", "https://images.example.sa/p1003/2.jpg"]
  },
  {
    title: "Downtown Dubai apartment 1BR",
    propertyUrl: "https://listings.example.ae/dubai-downtown-1br-2001",
    location: "Dubai",
    bedrooms: 1,
    priceValue: 980000,
    priceLabel: "980,000 AED",
    imageUrls: ["https://images.example.ae/p2001/1.jpg"]
  },
  {
    title: "Dubai Marina 2BR with sea view",
    propertyUrl: "https://homes.example.ae/dubai-marina-2br-2002",
    location: "Dubai",
    bedrooms: 2,
    priceValue: 1490000,
    priceLabel: "1,490,000 AED",
    imageUrls: ["https://images.example.ae/p2002/1.jpg", "https://images.example.ae/p2002/2.jpg"]
  },
  {
    title: "Abu Dhabi Yas Island townhouse 3BR",
    propertyUrl: "https://market.example.ae/abudhabi-yas-3br-2003",
    location: "Abu Dhabi",
    bedrooms: 3,
    priceValue: 1630000,
    priceLabel: "1,630,000 AED",
    imageUrls: ["https://images.example.ae/p2003/1.jpg"]
  },
  {
    title: "Riyadh studio in Al Malqa",
    propertyUrl: "https://listings.example.sa/riyadh-malqa-studio-1004",
    location: "Riyadh",
    bedrooms: 1,
    priceValue: 520000,
    priceLabel: "520,000 SAR",
    imageUrls: ["https://images.example.sa/p1004/1.jpg"]
  },
  {
    title: "Jeddah 3BR family apartment - Al Zahraa",
    propertyUrl: "https://homes.example.sa/jeddah-zahraa-3br-1005",
    location: "Jeddah",
    bedrooms: 3,
    priceValue: 1120000,
    priceLabel: "1,120,000 SAR",
    imageUrls: ["https://images.example.sa/p1005/1.jpg", "https://images.example.sa/p1005/2.jpg"]
  },
  {
    title: "Sharjah affordable 2BR apartment",
    propertyUrl: "https://market.example.ae/sharjah-2br-2004",
    location: "Sharjah",
    bedrooms: 2,
    priceValue: 610000,
    priceLabel: "610,000 AED",
    imageUrls: ["https://images.example.ae/p2004/1.jpg"]
  }
];

const LOCATION_HINTS = ["riyadh", "jeddah", "dammam", "dubai", "abu dhabi", "sharjah"] as const;

function toTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function inferLocation(input: PropertySearchInput): string | undefined {
  if (input.location && input.location.trim().length > 0) return input.location.trim();
  const query = input.query.toLowerCase();
  const hint = LOCATION_HINTS.find((candidate) => query.includes(candidate));
  if (!hint) return undefined;
  if (hint === "abu dhabi") return "Abu Dhabi";
  return hint.charAt(0).toUpperCase() + hint.slice(1);
}

function scoreItem(item: SeedProperty, tokens: string[], location: string | undefined, budget: number | undefined, bedrooms: number | undefined): number {
  let score = 0;
  const title = item.title.toLowerCase();
  const itemLocation = item.location.toLowerCase();

  for (const token of tokens) {
    if (title.includes(token)) score += 3;
    if (itemLocation.includes(token)) score += 2;
  }

  if (location && item.location.toLowerCase() === location.toLowerCase()) score += 10;
  if (bedrooms && item.bedrooms === bedrooms) score += 6;
  if (budget && item.priceValue <= budget) score += 5;

  return score;
}

export async function searchProperties(input: PropertySearchInput): Promise<PropertySearchResult> {
  const excluded = new Set((input.excludeUrls ?? []).map((url) => url.toLowerCase()));
  const tokens = toTokens(input.query);
  const location = inferLocation(input);

  const ranked = SEED_PROPERTIES
    .filter((item) => !excluded.has(item.propertyUrl.toLowerCase()))
    .filter((item) => (location ? item.location.toLowerCase() === location.toLowerCase() : true))
    .filter((item) => (input.budget ? item.priceValue <= input.budget : true))
    .filter((item) => (input.bedrooms ? item.bedrooms === input.bedrooms : true))
    .map((item) => ({ item, score: scoreItem(item, tokens, location, input.budget, input.bedrooms) }))
    .sort((a, b) => b.score - a.score || a.item.priceValue - b.item.priceValue)
    .slice(0, 8)
    .map(({ item }) => ({
      title: item.title,
      propertyUrl: item.propertyUrl,
      location: item.location,
      price: item.priceLabel,
      imageUrls: item.imageUrls
    }));

  return { items: ranked };
}
