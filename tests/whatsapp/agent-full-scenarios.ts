import type { FullGateCategory, FullGateScenario, ScenarioExpectedRoute } from "./types";

interface CategorySeed {
  category: FullGateCategory;
  prompts: string[];
  minCount: number;
  route: ScenarioExpectedRoute;
  language: "ar" | "en";
}

const CATEGORY_SEEDS: CategorySeed[] = [
  {
    category: "routing",
    minCount: 20,
    route: "property",
    language: "ar",
    prompts: [
      "شقق للبيع في الرياض",
      "apartments in Dubai Marina",
      "فلل في جدة",
      "more options in Riyadh",
      "details #2"
    ]
  },
  {
    category: "memory",
    minCount: 12,
    route: "property",
    language: "ar",
    prompts: [
      "تذكر أن ميزانيتي ١.٣ مليون",
      "my budget is 1500000 AED",
      "نفس المنطقة",
      "more like previous search"
    ]
  },
  {
    category: "multi_turn",
    minCount: 12,
    route: "property",
    language: "en",
    prompts: [
      "Find 3 bedroom apartments in Riyadh",
      "now switch to Jeddah",
      "compare top options",
      "details on first one"
    ]
  },
  {
    category: "search_scrape",
    minCount: 20,
    route: "property",
    language: "ar",
    prompts: [
      "شقق في دبي",
      "apartments in Abu Dhabi",
      "فلل في الدمام",
      "more options"
    ]
  },
  {
    category: "voice",
    minCount: 8,
    route: "property",
    language: "ar",
    prompts: [
      "[voice] ابحث عن شقة في دبي",
      "[voice] نعم كمل",
      "[voice] تعديل الميزانية"
    ]
  },
  {
    category: "wa_policy",
    minCount: 12,
    route: "market",
    language: "en",
    prompts: [
      "mortgage trends in Saudi",
      "best neighborhoods in Riyadh",
      "market update for Dubai"
    ]
  },
  {
    category: "failure_fallback",
    minCount: 10,
    route: "other",
    language: "ar",
    prompts: [
      "",
      "f",
      "???",
      "help"
    ]
  }
];

function buildFollowUps(category: FullGateCategory, index: number): string[] {
  if (category === "routing") return ["more options", "details #1"];
  if (category === "memory") return ["remember this", "show me properties"];
  if (category === "multi_turn") return ["more", "compare top"];
  if (category === "search_scrape") return ["more options", "details #2"];
  if (category === "voice") return [index % 2 === 0 ? "نعم، كمل" : "تعديل"];
  if (category === "wa_policy") return ["send short answer"];
  return ["try again"];
}

function generateCategoryScenarios(seed: CategorySeed): FullGateScenario[] {
  const rows: FullGateScenario[] = [];
  for (let index = 0; index < seed.minCount; index += 1) {
    const prompt = seed.prompts[index % seed.prompts.length] ?? seed.prompts[0] ?? "search properties";
    rows.push({
      id: `${seed.category}-${String(index + 1).padStart(2, "0")}`,
      category: seed.category,
      prompt,
      followUps: buildFollowUps(seed.category, index),
      language: seed.language,
      expectedRoute: seed.route,
      requiresLinks: prompt.toLowerCase().includes("link")
    });
  }
  return rows;
}

export function createFullGateScenarios(): FullGateScenario[] {
  return CATEGORY_SEEDS.flatMap((seed) => generateCategoryScenarios(seed));
}

export function summarizeScenarioCounts(scenarios: FullGateScenario[]): Record<FullGateCategory, number> {
  return scenarios.reduce<Record<FullGateCategory, number>>(
    (acc, scenario) => {
      acc[scenario.category] += 1;
      return acc;
    },
    {
      routing: 0,
      memory: 0,
      multi_turn: 0,
      search_scrape: 0,
      voice: 0,
      wa_policy: 0,
      failure_fallback: 0
    }
  );
}
