export function isForbiddenMetricName(name?: string | null): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return normalized === "operating cash flow".toLowerCase();
}
