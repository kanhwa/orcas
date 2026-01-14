const COLORS = ["#365E32", "#7F5235", "#4C7A9F", "#9B4F96", "#5C5C7A"] as const;

export function getSeriesColor(index: number): string {
  if (!Number.isFinite(index) || index < 0) return COLORS[0];
  return COLORS[index % COLORS.length];
}

export { COLORS };
