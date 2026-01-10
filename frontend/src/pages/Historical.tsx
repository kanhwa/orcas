import { useState, useEffect } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  historicalCompare,
  getEmitens,
  getYears,
  HistoricalCompareResponse,
  EmitenItem,
} from "../services/api";

export default function Historical() {
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
      const e = err as { detail?: string };
      setError(e.detail || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (val: number | null): string => {
    if (val === null) return "-";
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toFixed(2);
  };

  const formatPct = (val: number | null): string => {
    if (val === null || !isFinite(val)) return "N/A";
    return `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
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
  const sections = result
    ? [...new Set(result.metrics.map((m) => m.section))]
    : [];

  // Filter metrics
  const filteredMetrics = result?.metrics.filter((m) => {
    if (sectionFilter !== "all" && m.section !== sectionFilter) return false;
    if (showSignificantOnly && !m.is_significant) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold mb-4">📊 Historical Comparison</h2>
        <p className="text-gray-600 mb-4">
          Compare a single ticker's performance between two years. View metric-by-metric changes with trend indicators.
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
              {emitens.map((e) => (
                <option key={e.ticker_code} value={e.ticker_code}>
                  {e.ticker_code} - {e.bank_name || e.ticker_code}
                </option>
              ))}
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
                <h3 className="text-lg font-bold">
                  {result.ticker} - {result.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {result.year1} → {result.year2} ({result.year2 - result.year1}{" "}
                  years)
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.summary.improved}
                  </div>
                  <div className="text-gray-500">Improved</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {result.summary.declined}
                  </div>
                  <div className="text-gray-500">Declined</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {result.summary.stable}
                  </div>
                  <div className="text-gray-500">Stable</div>
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
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 rounded text-xs bg-gray-100">
                          {m.section}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatValue(m.value_year1)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatValue(m.value_year2)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-mono ${getTrendColor(
                          m.trend
                        )}`}
                      >
                        {formatPct(m.pct_change)}
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
                📭 No metrics match the current filters. Try adjusting your section or significance filter.
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
    </div>
  );
}
