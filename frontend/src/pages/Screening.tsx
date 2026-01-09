import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import InfoTooltip from "../components/InfoTip";
import {
  getMetrics,
  getMetricSummary,
  getYears,
  getEmitens,
  screenEmitens,
  MetricItem,
  MetricSummaryResponse,
  FilterOperator,
  ScreeningResponse,
  MetricFilter,
} from "../services/api";
import { toCatalogMetric, CatalogMetric } from "../shared/metricCatalog";

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: ">", label: "> (greater than)" },
  { value: "<", label: "< (less than)" },
  { value: ">=", label: ">= (at least)" },
  { value: "<=", label: "<= (at most)" },
  { value: "=", label: "= (equal to)" },
  { value: "between", label: "between (range)" },
];

interface FilterRow {
  id: number;
  metric_id: number | null;
  operator: FilterOperator;
  value: string;
  value_max: string;
  unit_choice: "base" | "mn" | "bn";
}

function convertInputToDataScale(
  raw: string,
  unit: string | null | undefined,
  unit_choice: "base" | "mn" | "bn"
): number | null {
  if (raw === "") return null;
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return null;

  // Percent metrics stored as ratio (e.g., 0.15 for 15%)
  if (unit === "%") {
    return num / 100;
  }

  if (unit && unit.toLowerCase().startsWith("idr")) {
    if (unit_choice === "mn") return num * 1_000_000;
    if (unit_choice === "bn") return num * 1_000_000_000;
  }

  return num;
}

function formatValueDisplay(value: number | null, unit?: string | null) {
  if (value === null || value === undefined) return "-";
  if (unit === "%") {
    return `${(value * 100).toFixed(2)} %`;
  }
  const abs = Math.abs(value);
  const formatted =
    abs >= 1_000_000_000
      ? `${(value / 1_000_000_000).toFixed(2)}B`
      : abs >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}M`
      : abs >= 1_000
      ? `${(value / 1_000).toFixed(2)}K`
      : value.toFixed(4);
  return unit ? `${formatted} ${unit}` : formatted;
}

export default function Screening() {
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [catalogMetrics, setCatalogMetrics] = useState<CatalogMetric[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [datasetSize, setDatasetSize] = useState<number>(32);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [filters, setFilters] = useState<FilterRow[]>([
    {
      id: 1,
      metric_id: null,
      operator: ">",
      value: "",
      value_max: "",
      unit_choice: "bn",
    },
  ]);
  const [activeSummary, setActiveSummary] =
    useState<MetricSummaryResponse | null>(null);
  const [result, setResult] = useState<ScreeningResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMetrics()
      .then((list) => {
        setMetrics(list);
        // Convert to catalog metrics for standardized display
        setCatalogMetrics(list.map(toCatalogMetric));
      })
      .catch(() => setError("Failed to load metrics"));

    getYears()
      .then((res) => {
        setYears(res.years);
        if (res.years.length > 0) setSelectedYear(res.years[0]);
      })
      .catch(() => setError("Failed to load years"));

    getEmitens()
      .then((res) => setDatasetSize(res.items.length))
      .catch(() => setDatasetSize(32));
  }, []);

  const metricsBySection = useMemo(() => {
    return catalogMetrics.reduce((acc, m) => {
      if (!acc[m.section]) acc[m.section] = [];
      acc[m.section].push(m);
      return acc;
    }, {} as Record<string, CatalogMetric[]>);
  }, [catalogMetrics]);

  const handleMetricChange = async (rowId: number, metricKey: string) => {
    // Find the metric by key to get its ID for the API
    const selectedMetric = metrics.find((m) => m.metric_name === metricKey);
    const metricId = selectedMetric?.id || null;

    setFilters((prev) =>
      prev.map((f) => (f.id === rowId ? { ...f, metric_id: metricId } : f))
    );
    try {
      if (metricId) {
        const summary = await getMetricSummary(metricId, selectedYear);
        setActiveSummary(summary);
      }
    } catch (e) {
      setActiveSummary(null);
    }
  };

  const addFilter = () => {
    const newId = Math.max(...filters.map((f) => f.id), 0) + 1;
    setFilters([
      ...filters,
      {
        id: newId,
        metric_id: null,
        operator: ">",
        value: "",
        value_max: "",
        unit_choice: "bn",
      },
    ]);
  };

  const removeFilter = (id: number) => {
    if (filters.length > 1) setFilters(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (
    id: number,
    field: keyof FilterRow,
    value: string | FilterOperator | number
  ) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleScreen = async () => {
    // Validate filters
    const metricFilters: MetricFilter[] = [];
    for (const f of filters) {
      if (!f.metric_id) {
        setError("Please select a metric for each filter");
        return;
      }
      if (!f.value) {
        setError("Please provide a value for each filter");
        return;
      }
      const metric = metrics.find((m) => m.id === f.metric_id);
      const unit = metric?.unit_config?.unit || null;
      const baseValue = convertInputToDataScale(f.value, unit, f.unit_choice);
      const baseMax = f.value_max
        ? convertInputToDataScale(f.value_max, unit, f.unit_choice)
        : null;
      if (
        metric?.unit_config?.allow_negative === false &&
        baseValue !== null &&
        baseValue < 0
      ) {
        setError("Negative values are not allowed for this metric");
        return;
      }
      if (baseValue === null) {
        setError("Invalid numeric value");
        return;
      }
      metricFilters.push({
        metric_id: f.metric_id,
        operator: f.operator,
        value: baseValue,
        value_max: f.operator === "between" ? baseMax : null,
      });
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await screenEmitens({
        year: selectedYear,
        filters: metricFilters,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.detail || "Screening failed");
    } finally {
      setLoading(false);
    }
  };

  const activeMetric = activeSummary
    ? metrics.find((m) => m.id === activeSummary.metric_id)
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-xl font-bold">🔍 Stock Screening</h2>
          <InfoTooltip
            ariaLabel="Info: Screening"
            content={
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Choose a year, add multiple filters, then run screening (AND
                  logic).
                </li>
                <li>
                  Use Data Hint to pick realistic thresholds (range/median).
                </li>
                <li>Results show tickers that satisfy all conditions.</li>
              </ul>
            }
          />
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Dataset size: {datasetSize} tickers
        </p>

        {/* Year Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Data Year</label>
          <select
            className="w-full max-w-xs px-3 py-2 border rounded-md text-sm"
            value={selectedYear}
            onChange={async (e) => {
              const y = Number(e.target.value);
              setSelectedYear(y);
              if (activeMetric) {
                try {
                  const summary = await getMetricSummary(activeMetric.id, y);
                  setActiveSummary(summary);
                } catch {
                  setActiveSummary(null);
                }
              }
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Builder */}
        <div className="space-y-3 mb-4">
          <label className="block text-sm font-medium">Filter Conditions</label>
          {filters.map((f, idx) => (
            <div
              key={f.id}
              className="flex flex-wrap gap-2 items-center p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-sm text-gray-500 w-6">{idx + 1}.</span>

              {(() => {
                const metric = metrics.find((m) => m.id === f.metric_id);
                const unit = metric?.unit_config?.unit || "";
                const unitIsIdr = unit.toLowerCase().startsWith("idr");
                const unitLabel = unitIsIdr
                  ? f.unit_choice === "bn"
                    ? "IDR bn"
                    : f.unit_choice === "mn"
                    ? "IDR mn"
                    : "IDR"
                  : unit || "unitless";
                return (
                  <>
                    {/* Metric Select */}
                    <select
                      className="flex-1 min-w-[220px] px-3 py-2 border rounded-md text-sm"
                      value={
                        f.metric_id
                          ? metrics.find((m) => m.id === f.metric_id)
                              ?.metric_name || ""
                          : ""
                      }
                      onChange={(e) => handleMetricChange(f.id, e.target.value)}
                    >
                      <option value="">-- Select Metric --</option>
                      {Object.entries(metricsBySection).map(
                        ([section, mets]) => (
                          <optgroup key={section} label={section}>
                            {mets.map((m) => (
                              <option key={m.key} value={m.key}>
                                {m.label}
                              </option>
                            ))}
                          </optgroup>
                        )
                      )}
                    </select>

                    {/* Operator Select */}
                    <select
                      className="w-40 px-3 py-2 border rounded-md text-sm"
                      value={f.operator}
                      onChange={(e) =>
                        updateFilter(
                          f.id,
                          "operator",
                          e.target.value as FilterOperator
                        )
                      }
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Unit choice for IDR metrics */}
                    <select
                      className="w-28 px-3 py-2 border rounded-md text-sm"
                      value={f.unit_choice}
                      disabled={!unitIsIdr}
                      onChange={(e) =>
                        updateFilter(f.id, "unit_choice", e.target.value)
                      }
                    >
                      <option value="base">Unit</option>
                      <option value="mn">IDR mn</option>
                      <option value="bn">IDR bn</option>
                    </select>

                    {/* Value Input */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="w-32 px-3 py-2 border rounded-md text-sm"
                        placeholder={`Value (${unitLabel})`}
                        value={f.value}
                        onChange={(e) =>
                          updateFilter(f.id, "value", e.target.value)
                        }
                      />
                      <span className="text-xs text-gray-500">{unitLabel}</span>
                    </div>

                    {/* Max Value for Between */}
                    {f.operator === "between" && (
                      <>
                        <span className="text-sm text-gray-500">to</span>
                        <input
                          type="number"
                          className="w-32 px-3 py-2 border rounded-md text-sm"
                          placeholder={`Max (${unitLabel})`}
                          value={f.value_max}
                          onChange={(e) =>
                            updateFilter(f.id, "value_max", e.target.value)
                          }
                        />
                      </>
                    )}

                    {/* Remove Button */}
                    {filters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFilter(f.id)}
                        className="text-red-500 hover:text-red-700 text-lg"
                      >
                        ✕
                      </button>
                    )}

                    {metric && (
                      <p className="text-xs text-gray-500 w-full">
                        Type: {metric.type || "unknown"} • Unit:{" "}
                        {metric.unit_config?.unit || "n/a"}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={addFilter} variant="secondary">
            + Add Filter
          </Button>
          <Button onClick={handleScreen} disabled={loading}>
            {loading ? "Processing..." : "🔍 Run Screening"}
          </Button>
        </div>

        {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
      </Card>

      {/* Data Hint */}
      {activeSummary && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                Data Hint — {activeSummary.display_name_en}
              </h3>
              <p className="text-sm text-gray-600">
                Type: {activeSummary.type || "unknown"}{" "}
                {activeSummary.type === "benefit" && "(Higher is better)"}
                {activeSummary.type === "cost" && "(Lower is better)"} • Unit:{" "}
                {activeSummary.unit_config?.unit || "n/a"}
              </p>
            </div>
            <div className="text-sm text-gray-600">
              Missing: {activeSummary.missing_count}/{activeSummary.total_count}
            </div>
          </div>
          {activeSummary.has_data ? (
            <p className="text-sm text-gray-700 mt-2">
              Range ({activeSummary.year}): min{" "}
              {formatValueDisplay(
                activeSummary.min,
                activeSummary.unit_config?.unit
              )}{" "}
              • median{" "}
              {formatValueDisplay(
                activeSummary.median,
                activeSummary.unit_config?.unit
              )}{" "}
              • max{" "}
              {formatValueDisplay(
                activeSummary.max,
                activeSummary.unit_config?.unit
              )}
            </p>
          ) : (
            <p className="text-sm text-red-600 mt-2">
              No data available for this metric/year.
            </p>
          )}
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <h3 className="text-lg font-bold mb-2">Screening Results</h3>
          <p className="text-sm text-gray-500 mb-4">
            Year {result.year} • {result.conditions.length} filters • Passed{" "}
            {result.stats.passed}/{result.stats.total}
          </p>

          {!result.has_data ? (
            <p className="text-red-600">
              No data available for selected metric/year.
            </p>
          ) : result.passed.length === 0 ? (
            <p className="text-gray-500">No banks match the filter criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Ticker</th>
                    <th className="px-4 py-2 text-left font-medium">Bank</th>
                    {result.conditions.map((c) => (
                      <th
                        key={c.metric_id}
                        className="px-4 py-2 text-right font-medium"
                      >
                        {c.display_name_en}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.passed.map((e, idx) => (
                    <tr key={e.ticker} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono font-bold">
                        {e.ticker}
                      </td>
                      <td className="px-4 py-2">{e.name}</td>
                      {result.conditions.map((c) => (
                        <td key={c.metric_id} className="px-4 py-2 text-right">
                          {formatValueDisplay(
                            e.values[String(c.metric_id)] ??
                              (e.values as any)[c.metric_id],
                            c.unit_config?.unit
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
