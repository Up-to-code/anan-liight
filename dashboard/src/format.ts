export function formatTime(epochMillis?: number): string {
  if (!epochMillis || !Number.isFinite(epochMillis)) return "-";
  return new Date(epochMillis).toLocaleString();
}
