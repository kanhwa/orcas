import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import {
  historicalCompare,
  getEmitens,
  getYears,
  createReport,
  HistoricalCompareResponse,
  EmitenItem,
} from "../services/api";
import { buildReportPdfBase64Async } from "../utils/reportPdf";
import { isForbiddenMetricName } from "../shared/metricsGuard";
import { toErrorMessage } from "../utils/errors";
import { getMetricUIConfig } from "../config/metricConfig";
import { useCatalog } from "../contexts/CatalogContext";

type UnitConfig = { displayUnit: string; inputMode: string };
type HistoricalMetricRow = HistoricalCompareResponse["metrics"][number] & {
  metric_key?: string | null;
};

const normalizeMetricName = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[(),]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeMetricKey = (value: string | null | undefined): string => {
  if (value === undefined || value === null) return "";
  const base = normalizeMetricName(String(value));
  return base.replace(/[_-]+/g, " ");
};

export default function Historical() {
  const { catalog } = useCatalog();
  const [emitens, setEmitens] = useState<EmitenItem[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [year1, setYear1] = useState(2020);
  const [year2, setYear2] = useState(2024);
  const [result, setResult] = useState<HistoricalCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [showSignificantOnly, setShowSignificantOnly] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [metricUnitMap, setMetricUnitMap] = useState<
    Record<string, UnitConfig>
  >({});
  const [metricUnitMapNormalized, setMetricUnitMapNormalized] = useState<
    Record<string, UnitConfig>
  >({});

  useEffect(() => {
    getEmitens()
      .then((res) => {
        setEmitens(res.items);
        if (res.items.length > 0) setSelectedTicker(res.items[0].ticker_code);
      })
      .catch(() => setError("Failed to load emitens"));

    getYears()
      .then((res) => {
        setYears(res.years);
        if (res.years.length >= 2) {
          setYear2(res.years[0]);
          setYear1(res.years[Math.min(4, res.years.length - 1)]);
        }
      })
      .catch(() => setError("Failed to load years"));
  }, []);

  useEffect(() => {
    const parseCsv = (text: string): string[][] => {
      const rows: string[][] = [];
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        if (!line.trim()) continue;
        const row: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i += 1;
            } else {
              inQuotes = !inQuotes;
            }
            continue;
          }
          if (ch === "," && !inQuotes) {
            row.push(current.trim());
            current = "";
            continue;
          }
          current += ch;
        }
        row.push(current.trim());
        rows.push(row);
      }

      return rows;
    };

    const loadMetricUnitMapping = async () => {
      try {
        const res = await fetch(`/metric_unit_mapping.csv`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const text = await res.text();
        const rows = parseCsv(text);
        if (!rows.length) return;

        const header = rows[0].map((h) => h.trim().toLowerCase());
        const metricIdx = header.indexOf("metric_name");
        const unitIdx = header.indexOf("display_unit");
        const modeIdx = header.indexOf("input_mode");
        if (metricIdx === -1 || unitIdx === -1 || modeIdx === -1) return;

        const map: Record<string, UnitConfig> = {};
        const normalized: Record<string, UnitConfig> = {};
        rows.slice(1).forEach((row) => {
          const metricName = (row[metricIdx] || "").trim();
          if (!metricName) return;
          const cfg = {
            displayUnit: (row[unitIdx] || "").trim(),
            inputMode: (row[modeIdx] || "").trim(),
          };
          map[metricName] = cfg;
          const normalizedKey = normalizeMetricKey(metricName);
          if (normalizedKey) normalized[normalizedKey] = cfg;
        });
        setMetricUnitMap(map);
        setMetricUnitMapNormalized(normalized);
      } catch (err) {
        console.error("Failed to load metric_unit_mapping.csv", err);
      }
    };

    loadMetricUnitMapping();
  }, []);

  const metricLabelToKey = useMemo(() => {
    const map = new Map<string, string>();
    if (!catalog) return map;
    catalog.sections.forEach((section) => {
      (section.metrics || []).forEach((metric) => {
        const key = metric.key || metric.label || "";
        const normalizedLabel = normalizeMetricKey(metric.label || key || "");
        const normalizedKey = normalizeMetricKey(key);
        if (normalizedLabel && key && !map.has(normalizedLabel)) {
          map.set(normalizedLabel, key);
        }
        if (normalizedKey && key && !map.has(normalizedKey)) {
          map.set(normalizedKey, key);
        }
      });
    });
    return map;
  }, [catalog]);

  const resolveUnitConfig = useCallback(
    (metric: HistoricalMetricRow): UnitConfig => {
      const directKey = metric.metric_key || null;
      const normalizedName = normalizeMetricKey(metric.metric_name);
      const catalogKey = normalizedName
        ? metricLabelToKey.get(normalizedName) || null
        : null;
      const candidates = [directKey, catalogKey, metric.metric_name].filter(
        (v): v is string => !!v && v.trim().length > 0
      );

      for (const candidate of candidates) {
        const cfg = metricUnitMap[candidate];
        if (cfg) return cfg;

        const normalized = normalizeMetricKey(candidate);
        if (normalized && metricUnitMap[normalized])
          return metricUnitMap[normalized];
        if (normalized && metricUnitMapNormalized[normalized])
          return metricUnitMapNormalized[normalized];
      }

      const fallback = getMetricUIConfig(directKey || metric.metric_name);
      return {
        displayUnit: fallback.displayUnit,
        inputMode: fallback.inputMode,
      };
    },
    [metricLabelToKey, metricUnitMap, metricUnitMapNormalized]
  );

  const getDisplayUnit = useCallback(
    (metric: HistoricalMetricRow): string => {
      const unit = resolveUnitConfig(metric).displayUnit;
      return unit || "—";
    },
    [resolveUnitConfig]
  );

  const formatMetricValueForMetric = useCallback(
    (
      metric: HistoricalMetricRow,
      rawValue: number | null | undefined,
      options?: { includeUnit?: boolean }
    ): string => {
      if (
        rawValue === null ||
        rawValue === undefined ||
        !Number.isFinite(rawValue)
      ) {
        return "—";
      }

      const cfg = resolveUnitConfig(metric);
      let displayValue = rawValue;
      if ((cfg.inputMode || "").toLowerCase() === "percent_points") {
        displayValue = rawValue * 100;
      }

      const formatNum = (value: number, decimals: number) =>
        new Intl.NumberFormat(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);

      const unit = (cfg.displayUnit || "").trim();
      const includeUnit = options?.includeUnit !== false;

      if (!includeUnit) {
        switch (unit) {
          case "%":
            return formatNum(displayValue, 2);
          case "ratio":
            return formatNum(displayValue, 4);
          case "x":
            return formatNum(displayValue, 2);
          default:
            return formatNum(displayValue, 2);
        }
      }

      switch (unit) {
        case "":
          return formatNum(displayValue, 2);
        case "%":
          return `${formatNum(displayValue, 2)}%`;
        case "x":
          return `${formatNum(displayValue, 2)}x`;
        case "ratio":
          return formatNum(displayValue, 4);
        default:
          return `${formatNum(displayValue, 2)} ${unit}`.trim();
      }
    },
    [resolveUnitConfig]
  );

  const handleCompare = async () => {
    if (!selectedTicker) {
      setError("Please select a ticker first");
      return;
    }
    // Allow same year comparison (will show no change)
    // if (year1 === year2) {
    //   setError("Please select 2 different years");
    //   return;
    // }

    setLoading(true);
    setSaveMessage("");
    setError("");
    setResult(null);

    try {
      const res = await historicalCompare({
        ticker: selectedTicker,
        year1: Math.min(year1, year2),
        year2: Math.max(year1, year2),
      });
      setResult(res);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const openSaveModal = () => {
    if (!result) return;
    const tickerLabel =
      result.name && result.name !== result.ticker
        ? `${result.ticker} — ${result.name}`
        : result.ticker;
    setReportName(`Historical ${tickerLabel} ${result.year1}-${result.year2}`);
    setSaveError("");
    setSaveMessage("");
    setSaveOpen(true);
  };

  const submitSave = async () => {
    if (!result) return;
    const name = reportName.trim();
    if (!name) {
      setSaveError("Name is required");
      return;
    }

    const yearsLabel = `${result.year1}–${result.year2}`;
    const tickerLabel =
      result.name && result.name !== result.ticker
        ? `${result.ticker} — ${result.name}`
        : result.ticker;
    const sectionLabel =
      sectionFilter === "all"
        ? "All Sections"
        : sectionFilter.charAt(0).toUpperCase() + sectionFilter.slice(1);
    const significantLabel = showSignificantOnly ? "Yes (20%)" : "No";

    const metadataForApi = {
      report_type: "compare_historical",
      ticker: result.ticker,
      name: result.name,
      year1: result.year1,
      year2: result.year2,
      summary: filteredSummary,
      filters: {
        section: sectionFilter,
        significant_only: showSignificantOnly,
      },
    };

    const pdfMetadata = [
      { label: "View", value: "Historical" },
      { label: "Ticker", value: tickerLabel },
      { label: "Years", value: yearsLabel },
      { label: "Section filter", value: sectionLabel },
      { label: "Only significant changes", value: significantLabel },
    ];

    const rows = filteredMetrics.map((m) => {
      const displayUnit = getDisplayUnit(m);
      const typeLabel = m.metric_type
        ? m.metric_type.charAt(0).toUpperCase() + m.metric_type.slice(1)
        : "";
      const trendLabel = getTrendLabel(m);
      return [
        m.metric_name,
        displayUnit,
        m.section,
        typeLabel,
        formatMetricValueForMetric(m, m.value_year1, { includeUnit: false }),
        formatMetricValueForMetric(m, m.value_year2, { includeUnit: false }),
        formatChangePct(m.pct_change),
        trendLabel,
      ];
    });

    const pdf_base64 = await buildReportPdfBase64Async({
      name,
      type: "compare_historical",
      metadata: pdfMetadata,
      sections: [
        {
          title: "Historical Comparison",
          columns: [
            "Metric",
            "Display Unit",
            "Section",
            "Type",
            `${result.year1}`,
            `${result.year2}`,
            "Change",
            "Trend",
          ],
          rows,
        },
      ],
    });

    setSaving(true);
    setSaveError("");
    try {
      await createReport({
        name,
        type: "compare_historical",
        pdf_base64,
        metadata: metadataForApi,
      });
      setSaveMessage("Saved to Reports.");
      setSaveOpen(false);
    } catch (err) {
      setSaveError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const formatChangePct = (val: number | null): string => {
    if (val === null || !isFinite(val)) return "—";
    return `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
  };

  const getTrendLabel = (
    metric: HistoricalMetricRow
  ): "Bullish" | "Bearish" | "Sideways" | "—" => {
    const trend = (metric.trend || "").toLowerCase();
    if (trend === "up") return "Bullish";
    if (trend === "down") return "Bearish";
    if (trend === "stable") return "Sideways";
    if (trend === "n/a") return "—";

    const start = metric.value_year1;
    const end = metric.value_year2;
    if (start === null || end === null || !isFinite(start) || !isFinite(end)) {
      return "—";
    }
    const delta = end - start;
    const isBenefit = (metric.metric_type || "").toLowerCase() === "benefit";
    const isCost = (metric.metric_type || "").toLowerCase() === "cost";
    const tiny = Math.abs(delta) < 1e-9;
    if (tiny) return "Sideways";
    if (isBenefit) return delta > 0 ? "Bullish" : "Bearish";
    if (isCost) return delta < 0 ? "Bullish" : "Bearish";
    return delta > 0 ? "Bullish" : "Bearish";
  };

  const getTrendIcon = (trend: string): string => {
    if (trend === "up") return "📈";
    if (trend === "down") return "📉";
    if (trend === "stable") return "➡️";
    return "❓";
  };

  const getTrendColor = (trend: string): string => {
    if (trend === "up") return "text-green-600";
    if (trend === "down") return "text-red-600";
    return "text-gray-500";
  };

  // Get unique sections from result
  const visibleMetrics = result
    ? result.metrics.filter((m) => !isForbiddenMetricName(m.metric_name))
    : [];

  const sections = visibleMetrics.length
    ? [...new Set(visibleMetrics.map((m) => m.section))]
    : [];

  const filteredMetrics = visibleMetrics.filter((m) => {
    if (sectionFilter !== "all" && m.section !== sectionFilter) return false;
    if (showSignificantOnly && !m.is_significant) return false;
    return true;
  });

  const summaryFromMetrics = (metrics: typeof visibleMetrics) => {
    return metrics.reduce(
      (acc, m) => {
        if (m.trend === "up") acc.improved += 1;
        else if (m.trend === "down") acc.declined += 1;
        else if (m.trend === "stable") acc.stable += 1;
        else acc.na += 1;
        return acc;
      },
      { improved: 0, declined: 0, stable: 0, na: 0 }
    );
  };

  const filteredSummary = summaryFromMetrics(filteredMetrics);

  const tickerDisplay = result
    ? result.name && result.name !== result.ticker
      ? `${result.ticker} — ${result.name}`
      : result.ticker
    : "";

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold mb-4">📊 Historical Comparison</h2>
        <p className="text-gray-600 mb-4">
          Compare a single ticker's performance between two years. View
          metric-by-metric changes with trend indicators.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Ticker Select */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Ticker
            </label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
            >
              {emitens.map((e) => {
                const label =
                  e.bank_name && e.bank_name !== e.ticker_code
                    ? `${e.ticker_code} — ${e.bank_name}`
                    : e.ticker_code;
                return (
                  <option key={e.ticker_code} value={e.ticker_code}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Year 1 */}
          <div>
            <label className="block text-sm font-medium mb-1">Start Year</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={year1}
              onChange={(e) => setYear1(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Year 2 */}
          <div>
            <label className="block text-sm font-medium mb-1">End Year</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={year2}
              onChange={(e) => setYear2(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleCompare}
              disabled={loading || !selectedTicker}
              className="w-full"
            >
              {loading ? "Processing..." : "🔍 Compare"}
            </Button>
          </div>
        </div>

        {/* Validation */}
        {!selectedTicker && (
          <p className="mt-3 text-yellow-600 text-sm">
            ⚠️ Please select a ticker to compare
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            ❌ {error}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <p className="mt-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Processing comparison...
          </p>
        )}
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Card */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">{tickerDisplay}</h3>
                <p className="text-sm text-gray-500">
                  {result.year1} → {result.year2} ({result.year2 - result.year1}{" "}
                  years)
                </p>
              </div>
              <div className="flex flex-col items-end gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Button variant="report" onClick={openSaveModal}>
                    Save to Reports
                  </Button>
                  {saveMessage && (
                    <span className="text-xs text-green-700">
                      {saveMessage}
                    </span>
                  )}
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {filteredSummary.improved}
                    </div>
                    <div className="text-gray-500">Improved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {filteredSummary.declined}
                    </div>
                    <div className="text-gray-500">Declined</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {filteredSummary.stable}
                    </div>
                    <div className="text-gray-500">Stable</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center border-t pt-4">
              <div>
                <label className="text-sm font-medium mr-2">Section:</label>
                <select
                  className="px-2 py-1 border rounded text-sm"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                >
                  <option value="all">All Sections</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSignificantOnly}
                  onChange={(e) => setShowSignificantOnly(e.target.checked)}
                />
                Only significant changes (&gt;20%)
              </label>
            </div>
          </Card>

          {/* Metrics Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Metric</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Display Unit
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Section</th>
                    <th className="px-4 py-2 text-right font-medium">
                      {result.year1}
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      {result.year2}
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Change</th>
                    <th className="px-4 py-2 text-center font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics?.map((m) => (
                    <tr
                      key={m.metric_name}
                      className={`border-t hover:bg-gray-50 ${
                        m.is_significant ? "bg-yellow-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2">
                        <div className="font-medium">{m.metric_name}</div>
                        <div className="text-xs text-gray-400">
                          {m.metric_type}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-left">
                        {getDisplayUnit(m)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 rounded text-xs bg-gray-100">
                          {m.section}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatMetricValueForMetric(m, m.value_year1)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatMetricValueForMetric(m, m.value_year2)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-mono ${getTrendColor(
                          m.trend
                        )}`}
                      >
                        {formatChangePct(m.pct_change)}
                        {m.is_significant && " ⚠️"}
                      </td>
                      <td className="px-4 py-2 text-center text-xl">
                        {getTrendIcon(m.trend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredMetrics?.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                📭 No metrics match the current filters. Try adjusting your
                section or significance filter.
              </p>
            )}

            {!result && !loading && !error && (
              <p className="text-center text-gray-500 py-8">
                Select a ticker and years, then click Compare to view results.
              </p>
            )}
          </Card>
        </>
      )}

      {saveOpen && (
        <Modal title="Save to Reports" onClose={() => setSaveOpen(false)}>
          <div className="space-y-3">
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Report name"
            />
            {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button variant="report" onClick={submitSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
