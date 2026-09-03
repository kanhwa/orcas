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
  const [summaries, setSummaries] = useState<Record<number, MetricSummaryResponse>>({});
  const [result, setResult] = useState<ScreeningResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("ai-is-loading", Boolean(aiLoading));
    return () => document.body.classList.remove("ai-is-loading");
  }, [aiLoading]);

  const [aiLanguage, setAiLanguage] = useState<"Indonesian" | "English">("Indonesian");
  const [aiError, setAiError] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
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
        setSummaries(prev => ({...prev, [rowId]: summary}));
      } else {
        setSummaries(prev => {
          const next = {...prev};
          delete next[rowId];
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };


  const moveFilterUp = (index: number) => {
    if (index === 0) return;
    setFilters(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveFilterDown = (index: number) => {
    if (index === filters.length - 1) return;
    setFilters(prev => {
      const next = [...prev];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
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


  const handleGenerateScreeningAi = async () => {
    if (!result) return;
    setAiLoading(true);
    setAiError("");
    setAiAnalysis("");
    
    try {
      let selectedBanks = result.passed;
      if (selectedBanks.length > 4) {
        selectedBanks = [
          selectedBanks[0],
          selectedBanks[1],
          selectedBanks[Math.floor(selectedBanks.length / 2)],
          selectedBanks[selectedBanks.length - 1]
        ];
      }
      
      const metricsInfo = filters.filter(f => f.metric_name).map(f => {
         const summary = summaries[f.id];
         return {
           metric: f.metric_name,
           condition: `${f.operator} ${f.value}`,
           hint: summary ? { min: summary.min, median: summary.median, max: summary.max } : null
         };
      });

      const payload = {
        year: selectedYear,
        metrics: metricsInfo,
        banks: selectedBanks,
        total_evaluated: result.stats.total,
        total_passed: result.stats.passed
      };

      const { generateScreeningInterpretation } = await import("../services/api");
      const res = await generateScreeningInterpretation(payload, aiLanguage);
      setAiAnalysis(res.analysis);
    } catch (err: any) {
      setAiError(err.message || "Failed to generate AI analysis");
    } finally {
      setAiLoading(false);
    }
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
          <h2 className="text-xl font-bold">Stock Screening</h2>
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
          <label className="block text-sm font-medium mb-1">Analyze Year</label>
          <select
            className="w-32 px-3 py-2 border border-[rgb(var(--color-primary))]/50 rounded-md text-sm"
            disabled={aiLoading}
            value={selectedYear}
            onChange={async (e) => {
              const y = Number(e.target.value);
              setSelectedYear(y);
              try {
                const updatedSummaries: Record<number, any> = {};
                await Promise.all(
                  filters.map(async (f) => {
                    if (f.metric_id) {
                      const summary = await getMetricSummary(f.metric_id, y);
                      updatedSummaries[f.id] = summary;
                    }
                  })
                );
                setSummaries(updatedSummaries);
              } catch (err) {
                console.error(err);
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
              <div className="flex flex-col items-center justify-center mr-1 gap-1">
                <button 
                  type="button"
                  onClick={() => moveFilterUp(idx)}
                  disabled={idx === 0 || aiLoading}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                </button>
                <span className="text-sm text-gray-500 font-bold">{idx + 1}</span>
                <button 
                  type="button"
                  onClick={() => moveFilterDown(idx)}
                  disabled={idx === filters.length - 1 || aiLoading}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </div>

              {(() => {
                const metric = metrics.find((m) => m.id === f.metric_id);
                const unit = metric?.unit_config?.unit || "unitless";
                return (
                  <>
                    {/* Metric Select */}
                    <select
                      disabled={aiLoading}
                      className="flex-1 min-w-[220px] px-3 py-2 border border-[rgb(var(--color-primary))]/50 rounded-md text-sm"
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
                        ([section, mets]) => {
                          const usedKeys = new Set(
                            filters
                              .filter((flt) => flt.id !== f.id && flt.metric_name)
                              .map((flt) => flt.metric_name)
                          );
                          const availableMets = mets.filter(m => !usedKeys.has(m.key));
                          if (availableMets.length === 0) return null;
                          return (
                          <optgroup key={section} label={section}>
                            {availableMets.map((m) => (
                              <option key={m.key} value={m.key}>
                                {m.label}
                              </option>
                            ))}
                          </optgroup>
                          );
                        }
                      )}
                    </select>

                    {/* Operator Select */}
                    <select
                      disabled={aiLoading}
                      className="w-40 px-3 py-2 border border-[rgb(var(--color-primary))]/50 rounded-md text-sm"
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
                        className="w-32 px-3 py-2 border border-[rgb(var(--color-primary))]/50 rounded-md text-sm"
                        placeholder={`Value (${unit})`}
                        disabled={aiLoading}
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
                          className="w-32 px-3 py-2 border border-[rgb(var(--color-primary))]/50 rounded-md text-sm"
                          placeholder={`Max (${unit})`}
                          disabled={aiLoading}
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
                        onClick={() => {
                          removeFilter(f.id);
                          setSummaries(prev => {
                            const next = {...prev};
                            delete next[f.id];
                            return next;
                          });
                        }}
                        className="text-red-500 hover:text-red-700 text-lg"
                      >
                        ✕
                      </button>
                    )}

                    {metric && (
                      <p className="text-xs text-gray-500 w-full mb-1">
                        Type: {metric.type || "unknown"} • Unit:{" "}
                        {metric.unit_config?.unit || "n/a"}
                      </p>
                    )}
                    
                    {/* Data Hint */}
                    {summaries[f.id] && (
                      <div className="w-full mt-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-blue-900">Data Hint: {f.metric_name}</span>
                          <span className="text-blue-700 text-xs">Missing: {summaries[f.id].missing_count}/{summaries[f.id].total_count}</span>
                        </div>
                        {summaries[f.id].has_data ? (
                          <p className="text-blue-900">
                            min: <span className="font-mono bg-white px-1 rounded">{formatMetricValue(f.metric_name || "", summaries[f.id].min)}</span> • 
                            median: <span className="font-mono bg-white px-1 rounded">{formatMetricValue(f.metric_name || "", summaries[f.id].median)}</span> • 
                            max: <span className="font-mono bg-white px-1 rounded">{formatMetricValue(f.metric_name || "", summaries[f.id].max)}</span>
                          </p>
                        ) : (
                          <p className="text-red-600">No data available for this metric/year.</p>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={addFilter} 
            variant="secondary"
            disabled={aiLoading || filters.length > 0 && (() => {
              const last = filters[filters.length - 1];
              if (!last.metric_name) return true;
              if (last.operator === "between") {
                return last.value === "" || last.value_max === "";
              }
              return last.value === "";
            })()}
          >
            + Add Filter
          </Button>
          <Button onClick={handleScreen} disabled={loading || aiLoading}>
            {loading ? "Processing..." : "Run Screening"}
          </Button>
        </div>

        {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Screening Results</h3>
            {result.passed.length > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="report" onClick={openSaveModal} disabled={aiLoading}>
                  Save to Reports
                </Button>
                {saveMessage && (
                  <span className="text-xs text-green-700">{saveMessage}</span>
                )}
                <div className="ml-auto">
                  <div className="flex rounded-md shadow-sm relative">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none border-r border-purple-500 pr-3 focus:ring-0"
                  onClick={handleGenerateScreeningAi}
                  disabled={aiLoading}
                >
                  {aiLoading ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}
                </Button>
                <div className="relative flex items-stretch">
                  <select
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}
                    className="appearance-none !bg-purple-600 hover:!bg-purple-700 !text-white rounded-l-none rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l-0 font-medium h-full min-h-[36px]"
                    disabled={aiLoading}
                  >
                    <option className="!bg-purple-600 !text-white" value="Indonesian">Indonesian</option>
                    <option className="!bg-purple-600 !text-white" value="English">English</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </div>
                </div>
              </div>
                </div>
              </div>
            )}
          </div>
          
          {aiError && <p className="text-red-500 text-sm mb-3">{aiError}</p>}
          
          {aiAnalysis && (
            <div className="bg-purple-50 border border-purple-100 rounded p-4 mb-3 text-sm text-purple-900 leading-relaxed shadow-sm whitespace-pre-wrap">
              <strong className="block mb-2 text-purple-950">Screening Analysis:</strong>
              {aiAnalysis}
            </div>
          )}
          
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
              className="w-full border border-[rgb(var(--color-primary))]/50 rounded px-3 py-2"
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
