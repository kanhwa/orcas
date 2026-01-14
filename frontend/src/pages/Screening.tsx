import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import InfoTooltip from "../components/InfoTip";
import {
  isMetricVisible,
  formatMetricValue,
  toBaseValue,
  getMetricUIConfig,
} from "../config/metricConfig";
import {
  getMetrics,
  getMetricSummary,
  getYears,
  getEmitens,
  screenEmitens,
  createReport,
  MetricItem,
  MetricSummaryResponse,
  FilterOperator,
  ConditionSummary,
  ScreeningResponse,
  MetricFilter,
} from "../services/api";
import { toCatalogMetric, CatalogMetric } from "../shared/metricCatalog";
import { isForbiddenMetricName } from "../shared/metricsGuard";
import { buildReportPdfBase64Async } from "../utils/reportPdf";
import { toErrorMessage } from "../utils/errors";

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
  metric_name?: string;
  operator: FilterOperator;
  value: string;
  value_max: string;
}

/**
 * Convert user input to base value for API using metricConfig.
 * Handles percent_points conversion automatically.
 */
function convertUserInputToBase(
  metricName: string,
  rawInput: string
): number | null {
  if (!rawInput || rawInput === "") return null;
  const num = parseFloat(rawInput);
  if (Number.isNaN(num)) return null;
  return toBaseValue(metricName, num);
}

function formatConditionDisplay(condition: ConditionSummary): string {
  const formattedMin = formatMetricValue(
    condition.metric_name,
    condition.value
  );
  if (
    condition.operator === "between" &&
    condition.value_max !== null &&
    condition.value_max !== undefined
  ) {
    const formattedMax = formatMetricValue(
      condition.metric_name,
      condition.value_max
    );
    return `between ${formattedMin} and ${formattedMax}`;
  }
  return `${condition.operator} ${formattedMin}`;
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
      metric_name: undefined,
      operator: ">",
      value: "",
      value_max: "",
    },
  ]);
  const [activeSummary, setActiveSummary] =
    useState<MetricSummaryResponse | null>(null);
  const [result, setResult] = useState<ScreeningResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
    return catalogMetrics
      .filter((m) => isMetricVisible(m.metric_name))
      .reduce((acc, m) => {
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
      prev.map((f) =>
        f.id === rowId
          ? { ...f, metric_id: metricId, metric_name: metricKey }
          : f
      )
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
        metric_name: undefined,
        operator: ">",
        value: "",
        value_max: "",
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
      if (!f.metric_id || !f.metric_name) {
        setError("Please select a metric for each filter");
        return;
      }
      if (!f.value) {
        setError("Please provide a value for each filter");
        return;
      }

      const metric = metrics.find((m) => m.id === f.metric_id);
      if (!metric) {
        setError("Metric not found");
        return;
      }

      const config = getMetricUIConfig(f.metric_name);
      const baseValue = convertUserInputToBase(f.metric_name, f.value);
      const baseMax = f.value_max
        ? convertUserInputToBase(f.metric_name, f.value_max)
        : null;

      if (!config.allowNegative && baseValue !== null && baseValue < 0) {
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
    setSaveMessage("");

    try {
      const res = await screenEmitens({
        year: selectedYear,
        filters: metricFilters,
      });
      setResult(res);
    } catch (err: any) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const activeMetric = activeSummary
    ? metrics.find((m) => m.id === activeSummary.metric_id)
    : null;
  const activeMetricName =
    filters.find((f) => f.metric_id === activeSummary?.metric_id)
      ?.metric_name || "";

  const visibleConditions = useMemo(
    () =>
      (result?.conditions || []).filter(
        (c) => !isForbiddenMetricName(c.metric_name)
      ),
    [result]
  );

  const openSaveModal = () => {
    if (!result || !result.passed.length) return;
    setReportName(`Screening ${result.year}`);
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

    const filterLines = visibleConditions.map((c) => ({
      metric_name: c.metric_name,
      condition: formatConditionDisplay(c),
      unit: c.unit_config?.unit || "n/a",
      has_data: c.has_data,
    }));

    const metadataForApi = {
      report_type: "analysis_screening",
      year: result.year,
      dataset_size: datasetSize,
      filters_applied: filterLines.map(
        (c) => `${c.metric_name}: ${c.condition}`
      ),
      filters_count: filterLines.length,
      passed: result.stats.passed,
      total: result.stats.total,
      missing_data_banks: result.stats.missing_data_banks,
      has_data: result.has_data,
    };

    const summaryRows = [
      ["Year", `${result.year}`],
      ["Dataset Size", `${datasetSize} tickers`],
      ["Passed / Total", `${result.stats.passed} / ${result.stats.total}`],
      [
        "Missing Data Banks",
        `${result.stats.missing_data_banks} / ${datasetSize}`,
      ],
    ];

    const appliedFilterRows = filterLines.map((c, idx) => [
      `Filter ${idx + 1}: ${c.metric_name}`,
      `${c.condition} (${c.unit})${c.has_data ? "" : " — no data"}`,
    ]);

    const appliedFiltersTable = {
      title: "Applied Filters",
      columns: ["Item", "Details"],
      rows: [...summaryRows, ...appliedFilterRows],
    };

    const columns = [
      "#",
      "Ticker",
      "Bank",
      ...visibleConditions.map((c) => c.metric_name),
    ];

    const screeningRows = result.passed.map((row, idx) => {
      const metricCells = visibleConditions.map((c) =>
        formatMetricValue(
          c.metric_name,
          row.values[String(c.metric_id)] ?? (row.values as any)[c.metric_id]
        )
      );
      return [idx + 1, row.ticker, row.name, ...metricCells];
    });

    const pdf_base64 = await buildReportPdfBase64Async({
      name,
      type: "analysis_screening",
      metadata: [],
      sections: [
        appliedFiltersTable,
        {
          title: "Screening Results",
          columns,
          rows: screeningRows,
          notes: result.has_data
            ? []
            : ["Data unavailable for selected criteria."],
        },
      ],
    });

    setSaving(true);
    setSaveError("");
    try {
      await createReport({
        name,
        type: "analysis_screening",
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
                const unit = metric?.unit_config?.unit || "unitless";
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

                    {/* Value Input */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="w-32 px-3 py-2 border rounded-md text-sm"
                        placeholder={`Value (${unit})`}
                        value={f.value}
                        onChange={(e) =>
                          updateFilter(f.id, "value", e.target.value)
                        }
                      />
                      <span className="text-xs text-gray-500">{unit}</span>
                    </div>

                    {/* Max Value for Between */}
                    {f.operator === "between" && (
                      <>
                        <span className="text-sm text-gray-500">to</span>
                        <input
                          type="number"
                          className="w-32 px-3 py-2 border rounded-md text-sm"
                          placeholder={`Max (${unit})`}
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
                Data Hint — {activeMetric?.metric_name || "Unknown"}
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
              {formatMetricValue(activeMetricName, activeSummary.min)} • median{" "}
              {formatMetricValue(activeMetricName, activeSummary.median)} • max{" "}
              {formatMetricValue(activeMetricName, activeSummary.max)}
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
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Screening Results</h3>
            {result.passed.length > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="report" onClick={openSaveModal}>
                  Save to Reports
                </Button>
                {saveMessage && (
                  <span className="text-xs text-green-700">{saveMessage}</span>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Year {result.year} • {visibleConditions.length} filters • Passed{" "}
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
                    {visibleConditions.map((c) => (
                      <th
                        key={c.metric_id}
                        className="px-4 py-2 text-right font-medium"
                      >
                        {c.metric_name}
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
                      {visibleConditions.map((c) => (
                        <td key={c.metric_id} className="px-4 py-2 text-right">
                          {formatMetricValue(
                            c.metric_name,
                            e.values[String(c.metric_id)] ??
                              (e.values as any)[c.metric_id]
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
