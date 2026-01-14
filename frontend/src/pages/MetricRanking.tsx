import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import InfoTooltip from "../components/InfoTip";
import { isMetricVisible, formatMetricValue } from "../config/metricConfig";
import {
  getAvailableMetrics,
  getYears,
  getMetricRankingPanel,
  getMetricRankingByYear,
  getEmitens,
  createReport,
  MetricItem,
  MetricPanelResponse,
  MetricYearTopResponse,
} from "../services/api";
import { toCatalogMetric, CatalogMetric } from "../shared/metricCatalog";
import { isForbiddenMetricName } from "../shared/metricsGuard";
import { buildReportPdfBase64Async } from "../utils/reportPdf";
import { toErrorMessage } from "../utils/errors";

type Mode = "panel" | "byYear";

export default function MetricRanking() {
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [catalogMetrics, setCatalogMetrics] = useState<CatalogMetric[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [datasetSize, setDatasetSize] = useState<number>(32);
  const [mode, setMode] = useState<Mode>("panel");
  const [selectedMetricId, setSelectedMetricId] = useState<number | null>(null);
  const [rankType, setRankType] = useState<"best" | "worst">("best");
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
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAvailableMetrics()
      .then((list) => {
        setMetrics(list);
        // Convert to catalog metrics for standardized display
        setCatalogMetrics(list.map(toCatalogMetric));
        if (list.length > 0) setSelectedMetricId(list[0].id);
        else setError("No metrics available. Please contact an administrator.");
      })
      .catch(() => setError("Failed to load metrics"));

    getYears()
      .then((res) => {
        setYears(res.years);
        if (res.years.length) {
          const maxYear = Math.max(...res.years);
          const minYear = Math.min(...res.years);
          setYearTo(maxYear);
          setYearFrom(Math.max(minYear, maxYear - 4));
          setSingleYear(maxYear);
        }
      })
      .catch(() => setError("Failed to load years"));

    getEmitens()
      .then((res) => setDatasetSize(res.items.length || 32))
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

  const clampTopN = (value: number) => {
    if (!Number.isFinite(value) || value < 1) {
      setWarning("Top N must be at least 1.");
      return 1;
    }
    if (value > datasetSize) {
      setWarning(`Top N capped at dataset size (${datasetSize}).`);
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
    setSaveMessage("");
    const cappedTopN = clampTopN(topN);
    setTopN(cappedTopN);
    try {
      const res = await getMetricRankingPanel({
        metric_id: selectedMetricId,
        from_year: yearFrom,
        to_year: yearTo,
        top_n: cappedTopN,
        rank_year: yearTo,
        rank_type: rankType,
      });
      setPanelResult(res);
    } catch (err: any) {
      setError(toErrorMessage(err));
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
    setSaveMessage("");
    const cappedTopN = clampTopN(topN);
    setTopN(cappedTopN);
    try {
      const res = await getMetricRankingByYear({
        metric_id: selectedMetricId,
        year: singleYear,
        top_n: cappedTopN,
        rank_type: rankType,
      });
      setYearResult(res);
    } catch (err: any) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const activeMetric = metrics.find((m) => m.id === selectedMetricId);
  const unit = activeMetric?.unit_config?.unit;

  const openSaveModal = () => {
    if (!panelResult && !yearResult) return;
    const defaultName = panelResult
      ? `Metric Ranking ${panelResult.metric_name} ${panelResult.from_year}-${panelResult.to_year}`
      : yearResult
      ? `Metric Ranking ${yearResult.metric_name} ${yearResult.year}`
      : "Metric Ranking";
    setReportName(defaultName);
    setSaveError("");
    setSaveMessage("");
    setSaveOpen(true);
  };

  const submitSave = async () => {
    if (!panelResult && !yearResult) return;
    const name = reportName.trim();
    if (!name) {
      setSaveError("Name is required");
      return;
    }

    if (activeMetric && isForbiddenMetricName(activeMetric.metric_name)) {
      setSaveError("This metric cannot be exported.");
      return;
    }

    const modeLabel =
      mode === "panel"
        ? "Multi-Year Panel (Top N fixed by End Year)"
        : "Single-Year Top N";
    const metricName =
      panelResult?.metric_name || yearResult?.metric_name || "";
    if (isForbiddenMetricName(metricName)) {
      setSaveError("This metric cannot be exported.");
      return;
    }
    const metricType = (
      panelResult?.metric_type ||
      yearResult?.metric_type ||
      ""
    )
      .toString()
      .toLowerCase();
    const metricTypeLabel =
      metricType === "benefit"
        ? "Benefit"
        : metricType === "cost"
        ? "Cost"
        : "Unknown";
    const unitLabel = activeMetric?.unit_config?.unit || "n/a";
    const rankTypeLabel = rankType === "best" ? "Best" : "Worst";

    const metadataLines = panelResult
      ? [
          { label: "Dataset Size", value: `${datasetSize} tickers` },
          { label: "Mode", value: modeLabel },
          { label: "Metric", value: metricName },
          { label: "Metric Type", value: metricTypeLabel },
          { label: "Rank Type", value: rankTypeLabel },
          { label: "Top N", value: panelResult.top_n },
          { label: "From Year", value: panelResult.from_year },
          { label: "To Year", value: panelResult.to_year },
          { label: "Rank Year", value: panelResult.rank_year },
          { label: "Unit", value: unitLabel },
        ]
      : [
          { label: "Dataset Size", value: `${datasetSize} tickers` },
          { label: "Mode", value: modeLabel },
          { label: "Metric", value: metricName },
          { label: "Metric Type", value: metricTypeLabel },
          { label: "Rank Type", value: rankTypeLabel },
          { label: "Top N", value: yearResult?.rankings.length || topN },
          { label: "Year", value: yearResult?.year ?? "—" },
          { label: "Unit", value: unitLabel },
        ];

    const metadataForApi = panelResult
      ? {
          report_type: "analysis_metric_ranking",
          dataset_size: datasetSize,
          mode: modeLabel,
          metric_name: metricName,
          metric_type: metricTypeLabel,
          rank_type: rankTypeLabel,
          top_n: panelResult.top_n,
          from_year: panelResult.from_year,
          to_year: panelResult.to_year,
          rank_year: panelResult.rank_year,
          unit: unitLabel,
        }
      : {
          report_type: "analysis_metric_ranking",
          dataset_size: datasetSize,
          mode: modeLabel,
          metric_name: metricName,
          metric_type: metricTypeLabel,
          rank_type: rankTypeLabel,
          top_n: yearResult?.rankings.length || topN,
          year: yearResult?.year ?? "—",
          unit: unitLabel,
        };

    const panelYears = panelResult
      ? Array.from(
          { length: panelResult.to_year - panelResult.from_year + 1 },
          (_, idx) => panelResult.from_year + idx
        )
      : [];

    const rows = panelResult
      ? panelResult.rows.map((row, idx) => {
          const valueCells = panelYears.map((y) =>
            formatMetricValue(metricName, row.values[String(y)])
          );
          return [idx + 1, row.ticker, row.name, ...valueCells];
        })
      : (yearResult?.rankings || []).map((r) => [
          r.rank,
          r.ticker,
          r.name,
          formatMetricValue(metricName, r.value),
        ]);

    const columns = panelResult
      ? ["Rank", "Ticker", "Bank", ...panelYears.map((y) => `${y}`)]
      : ["Rank", "Ticker", "Bank", "Value"];

    const pdf_base64 = await buildReportPdfBase64Async({
      name,
      type: "analysis_metric_ranking",
      metadata: metadataLines,
      sections: [
        {
          title: "Metric Ranking",
          columns,
          rows,
        },
      ],
    });

    setSaving(true);
    setSaveError("");
    try {
      await createReport({
        name,
        type: "analysis_metric_ranking",
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
          <h2 className="text-xl font-bold">🏆 Metric Ranking</h2>
          <InfoTooltip
            ariaLabel="Info: Metric Ranking"
            content={
              <ul className="list-disc space-y-1 pl-4">
                <li>Single-Year Top N: ranks banks for one selected year.</li>
                <li>
                  Multi-Year Panel: picks Top N by the end year, then shows the
                  same banks across the full year range.
                </li>
              </ul>
            }
          />
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Dataset size: {datasetSize} tickers
        </p>

        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Mode</span>
          <InfoTooltip
            ariaLabel="Info: Ranking modes"
            content={
              <ul className="list-disc space-y-1 pl-4">
                <li>Single-Year Top N: ranks banks for one selected year.</li>
                <li>
                  Multi-Year Panel: picks Top N by the end year, then shows the
                  same banks across the full year range.
                </li>
              </ul>
            }
          />
        </div>

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
            Multi-Year Panel (Top N fixed by End Year)
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
            Single-Year Top N
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Metric</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={
                selectedMetricId
                  ? metrics.find((m) => m.id === selectedMetricId)
                      ?.metric_name || ""
                  : ""
              }
              onChange={(e) => {
                // Convert metric key to metric ID
                const selectedMetric = metrics.find(
                  (m) => m.metric_name === e.target.value
                );
                setSelectedMetricId(selectedMetric?.id || null);
              }}
            >
              {!metrics.length && (
                <option value="">No metrics available</option>
              )}
              {metrics.length > 0 && selectedMetricId === null && (
                <option value="">-- Select Metric --</option>
              )}
              {Object.entries(metricsBySection).map(([section, mets]) => (
                <optgroup key={section} label={section}>
                  {mets.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
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
            <label className="block text-sm font-medium mb-1">Rank Type</label>
            <div className="flex gap-2">
              <button
                className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  rankType === "best"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
                onClick={() => setRankType("best")}
              >
                ⬆️ Best
              </button>
              <button
                className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  rankType === "worst"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
                onClick={() => setRankType("worst")}
              >
                ⬇️ Worst
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {rankType === "best"
                ? "Show top performers"
                : "Show bottom performers"}
            </p>
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
              <h3 className="text-lg font-bold">{panelResult.metric_name}</h3>
              <p className="text-sm text-gray-500">
                Type: {panelResult.metric_type || "unknown"} • Unit:{" "}
                {unit || "n/a"}
              </p>
              <p className="text-sm text-gray-500">
                Top N determined by {panelResult.rank_year}; showing values{" "}
                {panelResult.from_year}–{panelResult.to_year}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="report" onClick={openSaveModal}>
                Save to Reports
              </Button>
              {saveMessage && (
                <span className="text-xs text-green-700">{saveMessage}</span>
              )}
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
                    <th className="px-4 py-2 text-left font-medium">Rank</th>
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
                          {activeMetric &&
                            formatMetricValue(
                              activeMetric.metric_name,
                              row.values[String(y)]
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

      {yearResult && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold">{yearResult.metric_name}</h3>
              <p className="text-sm text-gray-500">
                Year {yearResult.year} • Type:{" "}
                {yearResult.metric_type || "unknown"} • Unit: {unit || "n/a"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="report" onClick={openSaveModal}>
                Save to Reports
              </Button>
              {saveMessage && (
                <span className="text-xs text-green-700">{saveMessage}</span>
              )}
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
                        {activeMetric &&
                          formatMetricValue(activeMetric.metric_name, r.value)}
                      </td>
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
