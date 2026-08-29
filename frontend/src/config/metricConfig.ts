/**
 * Metric Configuration Module
 * Provides a single source of truth for metric display/formatting rules.
 * All metrics from the backend MetricDefinition table should be configured here.
 */

export type DisplayUnit =
  | "%"
  | "ratio"
  | "x"
  | "IDR bn"
  | "IDR/share"
  | "bn shares";

export type InputMode = "as_is" | "percent_points";

export interface MetricUIConfig {
  /** Display unit suffix (e.g., "%", "IDR bn", "x") */
  displayUnit: DisplayUnit;
  /** How user input is converted to/from base values */
  inputMode: InputMode;
  /** Whether negative values are allowed */
  allowNegative: boolean;
}

/**
 * Metrics configuration by metric_name (exact DB identifier).
 * These are all visible metrics (39 total).
 * Operating Cash Flow is explicitly excluded (hidden).
 */
export const METRIC_CONFIG: Record<string, MetricUIConfig> = {
  "Aset Tetap": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Asset Turnover": {
    displayUnit: "ratio",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Book Value Per Share (BVPS)": {
    displayUnit: "IDR/share",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Giro Pada Bank Indonesia": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Kas Dan Setara Kas": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Penempatan Pada Bank Indonesia": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Pinjaman Yang Diberikan": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Pinjaman yang Diterima": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Price to Book Value (PBV)": {
    displayUnit: "x",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Simpanan Nasabah": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Tangible Book Value Per Share": {
    displayUnit: "IDR/share",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Total Aset": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Total Ekuitas": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Total Liabilitas": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Arus Kas Dari Aktivitas Investasi": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Arus Kas Dari Aktivitas Operasi": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Arus Kas Dari Aktivitas Pendanaan": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Capital expenditure": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Free cash flow": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Free cash flow per share": {
    displayUnit: "IDR/share",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Kas Dan Setara Kas Akhir Periode": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Kas Dan Setara Kas Awal Periode": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Kenaikan (Penurunan) Bersih Kas dan Setara Kas": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Beban Pajak Penghasilan": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Beban Usaha": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Earnings per Share (EPS)": {
    displayUnit: "IDR/share",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Jumlah Laba Komprehensif": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Laba Bersih Tahun Berjalan": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Laba Kotor": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Laba Sebelum Pajak": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Laba Usaha": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Pendapatan/Beban Lain-lain": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Price to Earnings Ratio (PER)": {
    displayUnit: "x",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Price to Sales (P/S)": {
    displayUnit: "x",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Return on Assets (ROA)": {
    displayUnit: "%",
    inputMode: "percent_points",
    allowNegative: true,
  },
  "Return on Equity (ROE)": {
    displayUnit: "%",
    inputMode: "percent_points",
    allowNegative: true,
  },
  "Saham Beredar (Share Outstanding)": {
    displayUnit: "bn shares",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Total Beban Pokok Penjualan": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Total Pendapatan": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
};

/**
 * Metrics that should be hidden from all frontend displays and dropdowns.
 * This is enforced via isMetricVisible() checks throughout the app.
 */
export const HIDDEN_METRICS = new Set<string>([
  "Operating Cash Flow", // Duplicate of "Cash Flow from Core Operations"
]);

/**
 * Check if a metric should be visible in UI.
 */
export function isMetricVisible(metricName: string): boolean {
  return !HIDDEN_METRICS.has(metricName);
}

/**
 * Get UI configuration for a metric, with safe defaults.
 */
export function getMetricUIConfig(metricName: string): MetricUIConfig {
  return (
    METRIC_CONFIG[metricName] || {
      displayUnit: "ratio",
      inputMode: "as_is",
      allowNegative: true,
    }
  );
}

/**
 * Convert a raw database value to display format.
 * Handles percent conversion and applies appropriate formatting.
 *
 * Examples:
 * - formatMetricValue("Return on Assets (ROA)", 0.0523) => "5.23%"
 * - formatMetricValue("Total Assets", 123456.78) => "123456.78 IDR bn"
 * - formatMetricValue("Current Ratio", 2.5) => "2.50x"
 */
export function formatMetricValue(
  metricName: string,
  rawValue: number | null | undefined
): string {
  if (rawValue === null || rawValue === undefined) {
    return "—";
  }

  const config = getMetricUIConfig(metricName);

  // Apply percent conversion if needed
  let displayValue = rawValue;
  if (config.inputMode === "percent_points") {
    displayValue = rawValue * 100;
  }

  const formatNum = (val: number, decimals: number) => 
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(val);

  // Format based on unit
  switch (config.displayUnit) {
    case "%":
      return `${formatNum(displayValue, 2)}%`;

    case "IDR bn":
      return `${formatNum(displayValue, 2)} IDR bn`;

    case "x":
      return `${formatNum(displayValue, 2)}x`;

    case "IDR/share":
      return `${formatNum(displayValue, 2)} IDR/share`;

    case "bn shares":
      return `${formatNum(displayValue, 2)} bn shares`;

    case "ratio":
    default:
      return formatNum(displayValue, 4);
  }
}

/**
 * Convert user input (as displayed) to base/API value.
 * Reverses formatMetricValue for percent metrics.
 *
 * Examples:
 * - toBaseValue("Return on Assets (ROA)", 5.23) => 0.0523
 * - toBaseValue("Total Assets", 123456.78) => 123456.78 (unchanged)
 */
export function toBaseValue(metricName: string, userInput: number): number {
  const config = getMetricUIConfig(metricName);

  // Only percent_points metrics need conversion
  if (config.inputMode === "percent_points") {
    return userInput / 100;
  }

  return userInput;
}

/**
 * Convert base/API value to display value (for user input fields).
 * Only relevant for percent_points metrics.
 *
 * Examples:
 * - fromBaseValue("Return on Assets (ROA)", 0.0523) => 5.23
 * - fromBaseValue("Total Assets", 123456.78) => 123456.78 (unchanged)
 */
export function fromBaseValue(metricName: string, rawValue: number): number {
  const config = getMetricUIConfig(metricName);

  // Only percent_points metrics need conversion
  if (config.inputMode === "percent_points") {
    return rawValue * 100;
  }

  return rawValue;
}
