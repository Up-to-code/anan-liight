import type { IntentScope } from "@agents/anan/search/types";

export function detectIntentScope(query: string): IntentScope {
  const text = query.toLowerCase();
  const propertyHints = ["apartment", "villa", "property", "شقة", "فلل", "عقار", "للبيع", "للإيجار"];
  return propertyHints.some((hint) => text.includes(hint)) ? "property" : "general";
}
