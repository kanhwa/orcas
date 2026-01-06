import { useState, useEffect } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  getMetricRanking,
  getAvailableMetrics,
  getYears,
  MetricRankingResponse,
  AvailableMetric,
} from "../services/api";

export default function MetricRanking() {
  const [metrics, setMetrics] = useState<AvailableMetric[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedMetric, setSelectedMetric] = useState("");
  const [yearFrom, setYearFrom] = useState(2020);
  const [yearTo, setYearTo] = useState(2024);
  const [topN, setTopN] = useState(3);
  const [result, setResult] = useState<MetricRankingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAvailableMetrics()
      .then((m) => {
        setMetrics(m);
        if (m.length > 0) setSelectedMetric(m[0].name);
      })
      .catch(() => setError("Failed to load metrics"));

    getYears()
      .then((res) => {
        setYears(res.years);
        if (res.years.length > 0) {
          setYearTo(res.years[0]);
          setYearFrom(
            Math.max(res.years[res.years.length - 1], res.years[0] - 4)
          );
        }
      })
      .catch(() => setError("Failed to load years"));
  }, []);

  const handleFetch = async () => {
    if (!selectedMetric) {
      setError("Please select a metric first");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await getMetricRanking({
        metric_name: selectedMetric,
        year_from: yearFrom,
        year_to: yearTo,
        top_n: topN,
      });
      setResult(res);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Failed to fetch ranking data");
    } finally {
      setLoading(false);
    }
  };

  // Group metrics by section
  const metricsBySection = metrics.reduce((acc, m) => {
    if (!acc[m.section]) acc[m.section] = [];
    acc[m.section].push(m);
    return acc;
  }, {} as Record<string, AvailableMetric[]>);

  const formatValue = (val: number | null): string => {
    if (val === null) return "-";
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toFixed(2);
  };

  // Get medal emoji for rank
  const getMedal = (rank: number): string => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  // Get all unique tickers from results (for tracking across years)
  const getAllTickers = (): string[] => {
    if (!result) return [];
    const tickers = new Set<string>();
    result.yearly_rankings.forEach((yr) => {
      yr.rankings.forEach((r) => tickers.add(r.ticker));
    });
    return Array.from(tickers);
  };

  // Color coding for tickers
  const tickerColors: Record<string, string> = {
    BBRI: "bg-blue-100 text-blue-800",
    BMRI: "bg-green-100 text-green-800",
    BBCA: "bg-purple-100 text-purple-800",
    BBNI: "bg-orange-100 text-orange-800",
    BNGA: "bg-pink-100 text-pink-800",
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold mb-4">🏆 Metric Ranking</h2>
        <p className="text-gray-600 mb-4">
          View Top N stocks for a specific metric across multiple years.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Metric Select */}
          <div>
            <label className="block text-sm font-medium mb-1">Metric</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
            >
              {Object.entries(metricsBySection).map(([section, mets]) => (
                <optgroup key={section} label={section.toUpperCase()}>
                  {mets.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.type})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Year From */}
          <div>
            <label className="block text-sm font-medium mb-1">From Year</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={yearFrom}
              onChange={(e) => setYearFrom(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Year To */}
          <div>
            <label className="block text-sm font-medium mb-1">
              To Year
            </label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={yearTo}
              onChange={(e) => setYearTo(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Top N */}
          <div>
            <label className="block text-sm font-medium mb-1">Top N</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 10].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button onClick={handleFetch} disabled={loading}>
          {loading ? "Processing..." : "🔍 View Ranking"}
        </Button>

        {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold">{result.metric_name}</h3>
              <p className="text-sm text-gray-500">
                Type: {result.metric_type} •{" "}
                {result.metric_type === "benefit"
                  ? "Higher is better ↑"
                  : "Lower is better ↓"}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {getAllTickers().map((t) => (
                <span
                  key={t}
                  className={`px-2 py-1 rounded text-xs font-mono ${
                    tickerColors[t] || "bg-gray-100 text-gray-800"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Ranking Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Rank</th>
                  {result.years.map((y) => (
                    <th key={y} className="px-4 py-2 text-center font-medium">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: topN }).map((_, rankIdx) => (
                  <tr key={rankIdx} className="border-t">
                    <td className="px-4 py-3 font-bold text-lg">
                      {getMedal(rankIdx + 1)}
                    </td>
                    {result.yearly_rankings.map((yr) => {
                      const item = yr.rankings.find(
                        (r) => r.rank === rankIdx + 1
                      );
                      return (
                        <td key={yr.year} className="px-4 py-3 text-center">
                          {item ? (
                            <div>
                              <div
                                className={`inline-block px-2 py-1 rounded font-mono font-bold ${
                                  tickerColors[item.ticker] || "bg-gray-100"
                                }`}
                              >
                                {item.ticker}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatValue(item.value)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trend Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">📊 Trend Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {getAllTickers()
                .slice(0, 4)
                .map((ticker) => {
                  const appearances = result.yearly_rankings.filter((yr) =>
                    yr.rankings.some((r) => r.ticker === ticker)
                  ).length;
                  const avgRank =
                    result.yearly_rankings.reduce((sum, yr) => {
                      const r = yr.rankings.find((x) => x.ticker === ticker);
                      return sum + (r ? r.rank : 0);
                    }, 0) / appearances;

                  return (
                    <div
                      key={ticker}
                      className="bg-white p-3 rounded shadow-sm"
                    >
                      <div className="font-mono font-bold">{ticker}</div>
                      <div className="text-gray-500">
                        Appears {appearances}/{result.years.length} years
                      </div>
                      <div className="text-gray-500">
                        Avg rank: {avgRank.toFixed(1)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
