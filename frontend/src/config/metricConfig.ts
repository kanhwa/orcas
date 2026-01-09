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
  // BALANCE SHEET
  "Cash and Cash Equivalents": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Short-term Investments": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Accounts Receivable": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  Inventory: {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Current Assets": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Fixed Assets": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Total Assets": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Accounts Payable": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Short-term Debt": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Current Liabilities": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Long-term Debt": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Total Liabilities": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Shareholders' Equity": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Retained Earnings": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },

  // INCOME STATEMENT
  Revenue: {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Cost of Goods Sold": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Gross Profit": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Operating Expense": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Operating Income": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Interest Expense": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Tax Expense": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Net Income": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },

  // RATIOS
  "Current Ratio": {
    displayUnit: "x",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Quick Ratio": {
    displayUnit: "x",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Debt to Equity Ratio": {
    displayUnit: "ratio",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Debt to Assets Ratio": {
    displayUnit: "ratio",
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
  "Gross Profit Margin": {
    displayUnit: "%",
    inputMode: "percent_points",
    allowNegative: true,
  },
  "Operating Profit Margin": {
    displayUnit: "%",
    inputMode: "percent_points",
    allowNegative: true,
  },
  "Net Profit Margin": {
    displayUnit: "%",
    inputMode: "percent_points",
    allowNegative: true,
  },
  "Earnings Per Share (EPS)": {
    displayUnit: "IDR/share",
    inputMode: "as_is",
    allowNegative: true,
  },

  // CASH FLOW
  "Operating Cash Flow": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Investing Cash Flow": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Financing Cash Flow": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Free Cash Flow": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Capital Expenditure": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: false,
  },
  "Cash Flow from Core Operations": {
    displayUnit: "IDR bn",
    inputMode: "as_is",
    allowNegative: true,
  },
  "Net Cash Flow": {
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

  // Format based on unit
  switch (config.displayUnit) {
    case "%":
      return `${displayValue.toFixed(2)}%`;

    case "IDR bn":
      return `${displayValue.toFixed(2)} IDR bn`;

    case "x":
      return `${displayValue.toFixed(2)}x`;

    case "IDR/share":
      return `${displayValue.toFixed(2)} IDR/share`;

    case "bn shares":
      return `${displayValue.toFixed(2)} bn shares`;

    case "ratio":
    default:
      return displayValue.toFixed(4);
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
