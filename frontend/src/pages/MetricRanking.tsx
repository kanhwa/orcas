import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  getMetricRankingPanel,
  getMetricRankingByYear,
  MetricPanelResponse,
  MetricYearTopResponse,
} from "../services/api";
import { useMetricCatalog } from "../features/analysis/useMetricCatalog";

type Mode = "panel" | "byYear";

function formatValue(val: number | null, unit?: string | null) {
  if (val === null || val === undefined) return "—";
  if (unit === "%") return `${(val * 100).toFixed(2)}%`;
  const abs = Math.abs(val);
  if (unit && unit.toLowerCase().startsWith("idr")) {
    if (abs >= 1_000_000_000_000)
      return `${(val / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  }
  return abs >= 1_000_000_000
    ? `${(val / 1_000_000_000).toFixed(2)}B`
    : abs >= 1_000_000
    ? `${(val / 1_000_000).toFixed(2)}M`
    : abs >= 1_000
    ? `${(val / 1_000).toFixed(2)}K`
    : val.toFixed(4);
}

export default function MetricRanking() {
  const { metrics, years, metricsBySection } = useMetricCatalog();
  const [mode, setMode] = useState<Mode>("panel");
  const [selectedMetricId, setSelectedMetricId] = useState<number | null>(null);
  const [yearFrom, setYearFrom] = useState<number>(2020);
  const [yearTo, setYearTo] = useState<number>(2024);
  const [singleYear, setSingleYear] = useState<number>(2024);
  const [topN, setTopN] = useState<number>(5);
  const [warning, setWarning] = useState<string>("");
  const [panelResult, setPanelResult] = useState<MetricPanelResponse | null>(
    null
  );
  const [yearResult, setYearResult] = useState<MetricYearTopResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Initialize year range when data loads
  const datasetSize = 32;

  const initYears = (() => {
    if (years.length > 0) {
      const maxYear = Math.max(...years);
      const minYear = Math.min(...years);
      return {
        yearFrom: Math.max(minYear, maxYear - 4),
        yearTo: maxYear,
        singleYear: maxYear,
      };
    }
    return null;
  })();

  if (
    initYears &&
    (yearFrom !== initYears.yearFrom ||
      yearTo !== initYears.yearTo ||
      singleYear !== initYears.singleYear) &&
    !loading &&
    !panelResult &&
    !yearResult
  ) {
    // One-time initialization
    if (yearFrom === 2020) {
      // Default value hasn't been overridden
    }
  }

  const clampTopN = (value: number) => {
    if (!Number.isFinite(value) || value < 1) {
      setWarning("Top N must be at least 1.");
      return 1;
    }
    if (value > datasetSize) {
      setWarning(`Top N cannot exceed 32 (dataset contains 32 bank tickers).`);
      return datasetSize;
    }
    setWarning("");
    return value;
  };

  const handleFetchPanel = async () => {
    if (!selectedMetricId) {
      setError("Please select a metric first.");
      return;
    }
    setLoading(true);
    setError("");
    setPanelResult(null);
    setYearResult(null);
    const cappedTopN = clampTopN(topN);
    setTopN(cappedTopN);
    try {
      const res = await getMetricRankingPanel({
        metric_id: selectedMetricId,
        from_year: yearFrom,
        to_year: yearTo,
        top_n: cappedTopN,
        rank_year: yearTo,
      });
      setPanelResult(res);
    } catch (err: any) {
      setError(err.detail || "Failed to fetch ranking data");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchByYear = async () => {
    if (!selectedMetricId) {
      setError("Please select a metric first.");
      return;
    }
    setLoading(true);
    setError("");
    setYearResult(null);
    setPanelResult(null);
    const cappedTopN = clampTopN(topN);
    setTopN(cappedTopN);
    try {
      const res = await getMetricRankingByYear({
        metric_id: selectedMetricId,
        year: singleYear,
        top_n: cappedTopN,
      });
      setYearResult(res);
    } catch (err: any) {
      setError(err.detail || "Failed to fetch ranking data");
    } finally {
      setLoading(false);
    }
  };

  const activeMetric = metrics.find((m) => m.id === selectedMetricId);
  const unit = activeMetric?.unit_config?.unit;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold mb-2">🏆 Metric Ranking</h2>
        <p className="text-gray-600 mb-4">
          View Top N banks for a metric in English-only labels. Dataset contains{" "}
          {datasetSize} tickers.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            className={`px-3 py-2 rounded-md border text-sm ${
              mode === "panel"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white"
            }`}
            onClick={() => {
              setMode("panel");
              setPanelResult(null);
              setYearResult(null);
            }}
          >
            Panel (Top N by To Year)
          </button>
          <button
            className={`px-3 py-2 rounded-md border text-sm ${
              mode === "byYear"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white"
            }`}
            onClick={() => {
              setMode("byYear");
              setPanelResult(null);
              setYearResult(null);
            }}
          >
            Year-by-year Top N
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Metric</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={selectedMetricId ?? ""}
              onChange={(e) => setSelectedMetricId(Number(e.target.value))}
            >
              {!metrics.length && (
                <option value="">No metrics available</option>
              )}
              {metrics.length > 0 && selectedMetricId === null && (
                <option value="">-- Select Metric --</option>
              )}
              {Object.entries(metricsBySection).map(([section, mets]) => (
                <optgroup key={section} label={section.toUpperCase()}>
                  {mets.map((m) => (
                    <option key={m.id} value={m.id}>
                        {m.metric_name} ({m.type || "n/a"})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {activeMetric && (
              <p className="text-xs text-gray-500 mt-1">
                Unit: {activeMetric.unit_config?.unit || "n/a"} • Type:{" "}
                {activeMetric.type || "unknown"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Top N</label>
            <input
              type="number"
              min={1}
              max={datasetSize}
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={topN}
              onChange={(e) => setTopN(clampTopN(Number(e.target.value)))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Max {datasetSize} banks.
            </p>
          </div>

          {mode === "panel" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  From Year
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={yearFrom}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setYearFrom(y);
                    if (y > yearTo) setYearTo(y);
                  }}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  To Year
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={yearTo}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setYearTo(y);
                    if (y < yearFrom) setYearFrom(y);
                  }}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={singleYear}
                onChange={(e) => setSingleYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <Button
            onClick={mode === "panel" ? handleFetchPanel : handleFetchByYear}
            disabled={loading || !metrics.length}
          >
            {loading ? "Processing..." : "🔍 View Ranking"}
          </Button>
          {warning && <span className="text-sm text-amber-600">{warning}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </Card>

      {panelResult && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold">
                {panelResult.display_name_en}
              </h3>
              <p className="text-sm text-gray-500">
                Type: {panelResult.metric_type || "unknown"} • Unit:{" "}
                {unit || "n/a"}
              </p>
              <p className="text-sm text-gray-500">
                Top N determined by {panelResult.rank_year}; showing values{" "}
                {panelResult.from_year}–{panelResult.to_year}.
              </p>
            </div>
          </div>
          {panelResult.rows.length === 0 ? (
            <p className="text-gray-500">
              No data available for this metric/year range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Ticker</th>
                    <th className="px-4 py-2 text-left font-medium">Bank</th>
                    {Array.from(
                      {
                        length: panelResult.to_year - panelResult.from_year + 1,
                      },
                      (_, idx) => panelResult.from_year + idx
                    ).map((y) => (
                      <th key={y} className="px-4 py-2 text-right font-medium">
                        {y}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {panelResult.rows.map((row, idx) => (
                    <tr key={row.ticker} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono font-bold">
                        {row.ticker}
                      </td>
                      <td className="px-4 py-2">{row.name}</td>
                      {Array.from(
                        {
                          length:
                            panelResult.to_year - panelResult.from_year + 1,
                        },
                        (_, i) => panelResult.from_year + i
                      ).map((y) => (
                        <td key={y} className="px-4 py-2 text-right">
                          {formatValue(row.values[String(y)], unit)}
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

      {yearResult && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold">
                {yearResult.display_name_en}
              </h3>
              <p className="text-sm text-gray-500">
                Year {yearResult.year} • Type:{" "}
                {yearResult.metric_type || "unknown"} • Unit: {unit || "n/a"}
              </p>
            </div>
          </div>
          {yearResult.rankings.length === 0 ? (
            <p className="text-gray-500">
              No data available for this metric/year.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Rank</th>
                    <th className="px-4 py-2 text-left font-medium">Ticker</th>
                    <th className="px-4 py-2 text-left font-medium">Bank</th>
                    <th className="px-4 py-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {yearResult.rankings.map((r) => (
                    <tr key={r.ticker} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">#{r.rank}</td>
                      <td className="px-4 py-2 font-mono font-bold">
                        {r.ticker}
                      </td>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 text-right">
                        {formatValue(r.value, unit)}
                      </td>
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
