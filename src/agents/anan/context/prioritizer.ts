export interface ContextFact {
  key: string;
  value: string;
  score: number;
}

export function prioritizeContextFacts(facts: ContextFact[], limit = 8): ContextFact[] {
  return [...facts]
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, limit);
}
