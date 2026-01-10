import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  type TooltipProps,
} from "recharts";
import { CompareRequest, CompareResponse, compare } from "../services/api";
import InfoTip from "../components/InfoTip";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { MultiSelect, MultiSelectOption } from "../components/ui/MultiSelect";
import { Toggle } from "../components/ui/Toggle";
import { useCatalog } from "../contexts/CatalogContext";
import Historical from "./Historical";

type Tab = "compare" | "historical";
type Mode = "overall" | "section";
type Section = "income" | "balance" | "cashflow";
type MissingPolicy = "zero" | "redistribute" | "drop";

interface MetricOption extends MultiSelectOption {
  description?: string;
  type?: "benefit" | "cost";
}

const TICKER_OPTIONS: MultiSelectOption[] = [
  "BBRI",
  "BBNI",
  "BMRI",
  "BBCA",
  "NISP",
  "BBTN",
  "BBKP",
  "BVIC",
  "BINA",
  "NOBU",
  "SDRA",
  "BJTM",
  "BJBR",
  "BDMN",
  "BNGA",
  "BSIM",
  "AGRS",
  "MAYA",
  "BABP",
  "BNII",
  "BNLI",
  "PNBN",
  "BTPN",
  "INPC",
  "DNAR",
  "BNBA",
  "MEGA",
  "MCOR",
  "BKSW",
  "BACA",
  "ARTO",
  "BMAS",
].map((t) => ({ value: t, label: t }));

function CompareTab() {
  const {
    getSectionMeta,
    getModeOptions,
    getMissingPolicyOptions,
    getYearOptions,
    getMetricsBySection,
  } = useCatalog();
  const [tickers, setTickers] = useState<string[]>([]);
  const [yearFrom, setYearFrom] = useState(2019);
  const [yearTo, setYearTo] = useState(2024);
  const [mode, setMode] = useState<Mode>("overall");
  const [section, setSection] = useState<Section>("income");
  const [metricKeys, setMetricKeys] = useState<string[]>([]);
  const [includeBenchmark, setIncludeBenchmark] = useState(false);
  const [missingPolicy, setMissingPolicy] = useState<MissingPolicy>("zero");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const years = getYearOptions();
  const modeOptions = useMemo(() => getModeOptions(), [getModeOptions]);
  const missingPolicyOptions = useMemo(
    () => getMissingPolicyOptions(),
    [getMissingPolicyOptions]
  );

  // Handle mode change - clear section/metrics when switching to overall
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (newMode === "overall") {
      // Clear section-specific state when switching to overall
      setMetricKeys([]);
    }
  };

  // Handle section change - clear metrics when section changes
  const handleSectionChange = (newSection: Section) => {
    setSection(newSection);
    setMetricKeys([]); // Reset metrics when section changes
  };

  const metricsOptions: MetricOption[] = useMemo(() => {
    if (mode !== "section") return [];
    const metrics = getMetricsBySection(section);
    return metrics.map((m) => ({
      value: m.key,
      label: m.label,
      description: m.description,
    }));
  }, [getMetricsBySection, section, mode]);

  // Validation helpers
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (tickers.length < 2) errors.push("Select at least 2 tickers");
    if (tickers.length > 4) errors.push("Maximum 4 tickers allowed");
    if (yearFrom > yearTo) errors.push("Start year must be ≤ End year");
    if (mode === "section" && metricKeys.length === 0) {
      errors.push("Select at least one metric for Section Ranking mode");
    }
    return errors;
  }, [tickers, yearFrom, yearTo, mode, metricKeys]);

  const isValid = validationErrors.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    // Validation is handled by isValid, but double-check
    if (!isValid) {
      setError(validationErrors.join("; "));
      return;
    }

    const payload: CompareRequest = {
      tickers,
      year_from: yearFrom,
      year_to: yearTo,
      mode,
      section: mode === "section" ? section : null,
      missing_policy: missingPolicy,
    };

    setLoading(true);
    try {
      const response = await compare(payload);
      setResult(response);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Failed to run comparison");
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (score: number | null) => {
    if (score === null) return "—";
    return score.toFixed(4);
  };

  const yearsAreSingle = yearFrom === yearTo;
  const dataWithBenchmark = useMemo(() => {
    if (!result) return null;
    const series = result.series;
    const withBench = includeBenchmark
      ? (() => {
          const bench = {
            ticker: "Average",
            scores: result.years.map((_, idx) => {
              const vals = series
                .map((s) => s.scores[idx])
                .filter((v): v is number => v !== null && v !== undefined);
              if (!vals.length) return null;
              return vals.reduce((a, b) => a + b, 0) / vals.length;
            }),
            missing_years: [],
          };
          return [...series, bench];
        })()
      : series;

    const tableRows = result.years.map((year, idx) => {
      const row: Record<string, number | null | string> = { year };
      withBench.forEach((s) => {
        row[s.ticker] = s.scores[idx];
      });
      return row;
    });

    return {
      series: withBench,
      rows: tableRows,
    };
  }, [includeBenchmark, result]);

  const bestWorstByYear = useMemo(() => {
    if (!dataWithBenchmark || !result)
      return {} as Record<number, { max: number; min: number }>;
    const map: Record<number, { max: number; min: number }> = {};
    result.years.forEach((year, idx) => {
      const values = dataWithBenchmark.series
        .map((s) => s.scores[idx])
        .filter((v): v is number => v !== null && v !== undefined);
      if (!values.length) return;
      map[year] = { max: Math.max(...values), min: Math.min(...values) };
    });
    return map;
  }, [dataWithBenchmark, result]);

  const chartData = useMemo(() => {
    if (!dataWithBenchmark || !result) return [];
    return result.years.map((year, idx) => {
      const entry: Record<string, number | string | null> = { year };
      dataWithBenchmark.series.forEach((s) => {
        entry[s.ticker] = s.scores[idx];
      });
      return entry;
    });
  }, [dataWithBenchmark, result]);

  const barTooltipFormatter: TooltipProps<number, string>["formatter"] = (
    value,
    name
  ) => {
    const numeric = typeof value === "number" ? value.toFixed(4) : "—";
    return [numeric, String(name)];
  };

  const lineTooltipFormatter: TooltipProps<number, string>["formatter"] = (
    value,
    name,
    props
  ) => {
    const numeric = typeof value === "number" ? value.toFixed(4) : "—";
    const year = (props?.payload as { year?: number } | undefined)?.year;
    return [numeric, `${String(name)}${year ? ` (${year})` : ""}`];
  };

  const renderChart = () => {
    if (!dataWithBenchmark || !result) return null;
    const colors = ["#365E32", "#7F5235", "#4C7A9F", "#9B4F96", "#5C5C7A"];

    if (yearsAreSingle) {
      const yearLabel = result.years[0];
      return (
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tickFormatter={() => `${yearLabel}`} />
              <YAxis />
              <Tooltip
                formatter={barTooltipFormatter}
                labelFormatter={() => `${yearLabel}`}
              />
              <Legend />
              {dataWithBenchmark.series.map((s, idx) => (
                <Bar
                  key={s.ticker}
                  dataKey={s.ticker}
                  name={s.ticker}
                  fill={colors[idx % colors.length]}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={lineTooltipFormatter} />
            <Legend />
            {dataWithBenchmark.series.map((s, idx) => (
              <Line
                key={s.ticker}
                type="monotone"
                dataKey={s.ticker}
                name={s.ticker}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card
        header={
          <div className="text-lg font-semibold text-[rgb(var(--color-text))]">
            Compare Tickers
          </div>
        }
      >
        <p className="mb-4 text-sm text-[rgb(var(--color-text-subtle))]">
          Compare scores for multiple tickers (max 4) across a year range. All
          options are catalog-driven.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Select Tickers (2-4 required)
              <InfoTip content="Choose 2 to 4 tickers to compare their WSM scores over time." />
            </label>
            <MultiSelect
              options={TICKER_OPTIONS}
              value={tickers}
              onChange={setTickers}
              maxSelected={4}
              placeholder="Pick tickers"
            />
            {tickers.length > 0 && tickers.length < 2 && (
              <p className="text-xs text-red-600">At least 2 tickers required</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Start Year
              </label>
              <Select
                value={yearFrom}
                onChange={(e) => setYearFrom(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                End Year
              </label>
              <Select
                value={yearTo}
                onChange={(e) => setYearTo(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Mode
                <InfoTip
                  content={
                    getModeOptions().find((m) => m.key === mode)?.description ||
                    "Overall uses all sections; Section focuses on specific metrics."
                  }
                />
              </label>
              <Select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as Mode)}
              >
                {modeOptions.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
              {mode === "overall" && (
                <p className="text-xs text-[rgb(var(--color-text-subtle))] italic">
                  Overall Score uses all sections and metrics from the catalog.
                </p>
              )}
            </div>

            {mode === "section" && (
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                  Section
                  <InfoTip
                    content={
                      getSectionMeta(section)?.description ||
                      "Select financial statement section for focused comparison."
                    }
                  />
                </label>
                <Select
                  value={section}
                  onChange={(e) => handleSectionChange(e.target.value as Section)}
                >
                  {["income", "balance", "cashflow"].map((s) => {
                    const meta = getSectionMeta(s);
                    return (
                      <option key={s} value={s}>
                        {meta?.label || s}
                      </option>
                    );
                  })}
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Missing Data Policy
                <InfoTip
                  content={
                    getMissingPolicyOptions().find(
                      (p) => p.key === missingPolicy
                    )?.description ||
                    "Zero: missing values = 0. Redistribute: share weights. Drop: exclude incomplete tickers."
                  }
                />
              </label>
              <Select
                value={missingPolicy}
                onChange={(e) =>
                  setMissingPolicy(e.target.value as MissingPolicy)
                }
              >
                {missingPolicyOptions.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>

            {mode === "section" && (
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                  Metrics (catalog)
                  <InfoTip content="Select metrics from the chosen section. At least one metric is required for Section Ranking." />
                </label>
                <MultiSelect
                  options={metricsOptions}
                  value={metricKeys}
                  onChange={setMetricKeys}
                  maxSelected={8}
                  placeholder="Select metrics"
                  disabled={metricsOptions.length === 0}
                />
                {metricKeys.length === 0 && mode === "section" && (
                  <p className="text-xs text-red-600">
                    At least one metric required for Section Ranking
                  </p>
                )}
                {metricKeys.length > 0 && (
                  <p className="text-xs text-[rgb(var(--color-text-subtle))]">
                    {metricKeys.length} metric(s) selected
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Toggle
              pressed={includeBenchmark}
              onChange={setIncludeBenchmark}
              label="Include Average (computed from selected tickers)"
            />
            <Button type="submit" disabled={loading || !isValid}>
              {loading ? "Loading..." : "Run Compare"}
            </Button>
          </div>

          {/* Validation Errors */}
          {!isValid && validationErrors.length > 0 && (
            <div className="rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
              <p className="font-semibold mb-1">Please fix the following:</p>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </form>

        {/* Loading State */}
        {loading && (
          <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Processing comparison...
          </div>
        )}

        {/* Error State */}
        {error && (
          <p
            className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            ❌ {error}
          </p>
        )}

        {/* Empty Results State */}
        {result && result.series.length === 0 && (
          <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            No data available for the selected inputs.
          </p>
        )}

        {result && dataWithBenchmark && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--color-text-subtle))]">
              <span>
                Mode:{" "}
                <strong className="text-[rgb(var(--color-text))]">
                  {mode === "section" ? `Section (${section})` : "Overall"}
                </strong>
              </span>
              <span>
                Years:{" "}
                <strong className="text-[rgb(var(--color-text))]">
                  {result.years[0]} - {result.years[result.years.length - 1]}
                </strong>
              </span>
            </div>

            {renderChart()}

            <Table>
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    {dataWithBenchmark.series.map((s) => (
                      <th key={s.ticker}>{s.ticker}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.years.map((year, yIdx) => (
                    <tr key={year}>
                      <td className="font-semibold text-[rgb(var(--color-primary))]">
                        {year}
                      </td>
                      {dataWithBenchmark.series.map((s) => {
                        const score = s.scores[yIdx];
                        const isMissing = s.missing_years.includes(year);
                        const bestWorst = bestWorstByYear[year];
                        const isBest =
                          bestWorst &&
                          score !== null &&
                          score === bestWorst.max;
                        const isWorst =
                          bestWorst &&
                          score !== null &&
                          score === bestWorst.min;
                        return (
                          <td
                            key={s.ticker}
                            className={`${
                              isMissing
                                ? "italic text-[rgb(var(--color-text-subtle))]"
                                : "text-[rgb(var(--color-text))]"
                            } ${
                              isBest
                                ? "bg-green-50 text-green-700 font-semibold"
                                : isWorst
                                ? "bg-red-50 text-red-700 font-semibold"
                                : ""
                            }`}
                          >
                            {formatScore(score)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>

            {dataWithBenchmark.series.some(
              (s) => s.missing_years.length > 0
            ) && (
              <p className="text-xs italic text-[rgb(var(--color-text-subtle))]">
                “—” indicates data not available for that year.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
// Tabbed wrapper component that combines Compare and Historical
export default function ComparePage() {
  const [activeTab, setActiveTab] = useState<Tab>("compare");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <Card>
        <div className="flex border-b border-[rgb(var(--color-border))]">
          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "compare"
                ? "text-[rgb(var(--color-primary))]"
                : "text-[rgb(var(--color-text-subtle))] hover:text-[rgb(var(--color-text))]"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📈</span>
              Compare Stocks
            </span>
            {activeTab === "compare" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary))]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("historical")}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "historical"
                ? "text-[rgb(var(--color-primary))]"
                : "text-[rgb(var(--color-text-subtle))] hover:text-[rgb(var(--color-text))]"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📊</span>
              Historical
            </span>
            {activeTab === "historical" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary))]" />
            )}
          </button>
        </div>

        {/* Tab Description */}
        <div className="p-4 bg-[rgb(var(--color-surface))]">
          {activeTab === "compare" ? (
            <p className="text-sm text-[rgb(var(--color-text-subtle))]">
              Compare WSM scores across multiple stocks (2-4) over a range of
              years with line/bar charts.
            </p>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-subtle))]">
              View detailed metric-by-metric comparison for a single stock
              between two years.
            </p>
          )}
        </div>
      </Card>

      {/* Tab Content */}
      <div>{activeTab === "compare" ? <CompareTab /> : <Historical />}</div>
    </div>
  );
}
