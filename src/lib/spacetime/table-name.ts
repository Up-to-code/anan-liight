/**
 * Normalizes runtime table names into Spacetime naming format.
 * Example: "sessionTokens" -> "session_tokens".
 */
export function toSpacetimeTableName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}
