import React, { useState, useEffect, useMemo } from "react";
import { isMetricVisible } from "../config/metricConfig";
import { useCatalog } from "../contexts/CatalogContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { getEmitens, EmitenItem, simulate, getYears } from "../services/api";
import InfoTip from "../components/InfoTip";

interface MetricAdjustment {
  id: string;
  section: string;
  metric_name: string;
  baseline_value: number | null;
  adjustment_percent: number; // -100 to +300
}

interface SimulationResult {
  ticker: string;
  ticker_name: string;
  baseline_year: number;
  simulation_year: string;
  baseline_score: number;
  simulated_score: number;
  delta: number;
  delta_percent: number;
  warnings: string[];
}

const Simulation: React.FC = () => {
  const { catalog, getYearOptions } = useCatalog();

  // Emiten dropdown data
  const [emitens, setEmitens] = useState<EmitenItem[]>([]);
  const [loadingEmitens, setLoadingEmitens] = useState(true);

  // Years
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Form state
  const [selectedTicker, setSelectedTicker] = useState("");
  const [adjustments, setAdjustments] = useState<MetricAdjustment[]>([]);
  const [nextId, setNextId] = useState(1);

  // Results
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load emitens and years on mount
  useEffect(() => {
    const loadEmitens = async () => {
      try {
        const res = await getEmitens();
        setEmitens(res.items || []);
      } catch (err) {
        console.error("Failed to load emitens:", err);
      } finally {
        setLoadingEmitens(false);
      }
    };

    const loadYears = async () => {
      try {
        const res = await getYears();
        setAvailableYears(res.years || []);
      } catch (err) {
        console.error("Failed to load years:", err);
        // Fallback: use hardcoded years
        setAvailableYears(getYearOptions());
      }
    };

    loadEmitens();
    loadYears();
  }, []);

  // Compute baseline year (latest available year)
  const baselineYear = useMemo(() => {
    if (availableYears.length === 0) return null;
    return Math.max(...availableYears);
  }, [availableYears]);

  const scenarioYearLabel = baselineYear ? `${baselineYear + 1}` : "N/A";

  // Get all metrics from all sections (flattened)
  const allMetrics = useMemo(() => {
    if (!catalog) return [];
    const metrics: {
      section: string;
      sectionLabel: string;
      key: string;
      label: string;
    }[] = [];
    for (const section of catalog.sections) {
      for (const metric of section.metrics) {
        // Filter out hidden metrics
        if (isMetricVisible(metric.key)) {
          metrics.push({
            section: section.key,
            sectionLabel: section.label,
            key: metric.key,
            label: metric.label,
          });
        }
      }
    }
    return metrics;
  }, [catalog]);

  // Get already selected metric keys (to prevent duplicates)
  const selectedMetricKeys = useMemo(() => {
    return new Set(adjustments.map((a) => a.metric_name));
  }, [adjustments]);

  // Available metrics for selection (excluding already selected)
  const availableMetrics = useMemo(() => {
    return allMetrics.filter((m) => !selectedMetricKeys.has(m.key));
  }, [allMetrics, selectedMetricKeys]);

  // Add new metric adjustment row
  const addAdjustment = () => {
    if (availableMetrics.length === 0) return;

    setAdjustments([
      ...adjustments,
      {
        id: `adj-${nextId}`,
        section: "",
        metric_name: "",
        baseline_value: null,
        adjustment_percent: 0,
      },
    ]);
    setNextId(nextId + 1);
  };

  // Remove adjustment row
  const removeAdjustment = (id: string) => {
    setAdjustments(adjustments.filter((a) => a.id !== id));
  };

  // Update adjustment
  const updateAdjustment = (
    id: string,
    field: keyof MetricAdjustment,
    value: string | number
  ) => {
    setAdjustments(
      adjustments.map((a) => {
        if (a.id !== id) return a;

        if (field === "metric_name" && typeof value === "string") {
          // When metric is selected, also set its section
          const metric = allMetrics.find((m) => m.key === value);
          return {
            ...a,
            metric_name: value,
            section: metric?.section || "",
          };
        }

        return { ...a, [field]: value };
      })
    );
  };

  // Run simulation
  const handleSimulate = async () => {
    if (!selectedTicker) {
      setError("Please select a ticker");
      return;
    }

    if (baselineYear === null) {
      setError("Baseline year not available");
      return;
    }

    const validAdjustments = adjustments.filter((a) => a.metric_name);
    if (validAdjustments.length === 0) {
      setError("Please add at least one metric adjustment");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Build overrides - backend expects value as the percentage adjustment
      const overrides = validAdjustments.map((a) => ({
        metric_name: a.metric_name,
        value: a.adjustment_percent, // Percentage adjustment
      }));

      const response = await simulate({
        ticker: selectedTicker,
        year: baselineYear,
        mode: "overall",
        section: null,
        overrides,
        missing_policy: "zero",
      });

      // Find emiten name and format (remove "Unknown" suffix)
      const emiten = emitens.find((e) => e.ticker_code === selectedTicker);
      let tickerName = emiten?.bank_name || selectedTicker;
      // Remove "- Unknown" or "Unknown" suffix
      if (tickerName && (tickerName.includes("Unknown") || tickerName.endsWith("- "))) {
        tickerName = tickerName.replace(/\s*-\s*Unknown$/, "").replace(/^Unknown\s*-?\s*/, "").trim() || selectedTicker;
      }

      const baselineScore = response.baseline_score || 0;
      const simulatedScore = response.simulated_score || 0;
      const delta = response.delta || 0;

      setResult({
        ticker: selectedTicker,
        ticker_name: tickerName,
        baseline_year: baselineYear,
        simulation_year: scenarioYearLabel,
        baseline_score: baselineScore,
        simulated_score: simulatedScore,
        delta: delta,
        delta_percent: baselineScore ? (delta / baselineScore) * 100 : 0,
        warnings: response.message ? [response.message] : [],
      });
    } catch (err) {
      const e = err as { detail?: string };
      setError(e.detail || "Simulation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setSelectedTicker("");
    setAdjustments([]);
    setResult(null);
    setError(null);
  };

  // Format number with sign
  const formatDelta = (value: number) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}`;
  };

  // Get color based on delta
  const getDeltaColor = (value: number) => {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🧪</span>
            <div>
              <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">
                Simulation Scenario
              </h2>
              <p className="text-sm text-[rgb(var(--color-text-subtle))]">
                Test how metric changes affect the score for a specific emiten.
                Adjust metric values by percentage to see projected impact.
              </p>
            </div>
          </div>

          {/* Simulation Info */}
          <div className="bg-[rgb(var(--color-surface))] rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-sm mb-3">
              <span className="font-medium">Baseline Year:</span>
              <span className="bg-[rgb(var(--color-primary))] text-white px-2 py-0.5 rounded">
                {baselineYear || "Loading..."}
              </span>
              <span className="mx-2">→</span>
              <span className="font-medium">Scenario Year:</span>
              <span className="bg-[rgb(var(--color-action))] text-white px-2 py-0.5 rounded">
                {scenarioYearLabel}
              </span>
            </div>
            <div className="text-xs text-[rgb(var(--color-text-subtle))] bg-blue-50 border border-blue-200 rounded p-2">
              ℹ️ Scenario year is a label for what-if analysis, not a forecast.
            </div>
          </div>

          {/* Ticker Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[rgb(var(--color-text))] mb-2">
              Select Emiten
              <InfoTip content="Choose the emiten you want to simulate. Only one emiten can be selected per simulation." />
            </label>
            <Select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              disabled={loadingEmitens}
            >
              <option value="">-- Select Ticker --</option>
              {emitens.map((e) => {
                // Format emiten name: remove "Unknown" suffix
                let displayName = e.bank_name || "";
                if (displayName && displayName.includes("Unknown")) {
                  displayName = displayName.replace(/\s*-\s*Unknown$/, "").replace(/^Unknown\s*-?\s*/, "").trim();
                }
                const finalName = displayName || "Unknown";
                return (
                  <option key={e.ticker_code} value={e.ticker_code}>
                    {e.ticker_code}
                    {finalName && finalName !== "Unknown" ? ` - ${finalName}` : ""}
                  </option>
                );
              })}
            </Select>
          </div>

          {/* Metric Adjustments */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-[rgb(var(--color-text))]">
                Metric Adjustments
                <InfoTip content="Select metrics and set percentage adjustments. Positive values increase, negative values decrease the metric." />
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={addAdjustment}
                disabled={availableMetrics.length === 0}
              >
                + Add Metric
              </Button>
            </div>

            {adjustments.length === 0 ? (
              <div className="text-center py-8 bg-[rgb(var(--color-surface))] rounded-lg border-2 border-dashed border-[rgb(var(--color-border))]">
                <p className="text-[rgb(var(--color-text-subtle))]">
                  No metrics added yet. Click "Add Metric" to start.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {adjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="flex items-center gap-3 p-3 bg-[rgb(var(--color-surface))] rounded-lg"
                  >
                    {/* Metric Dropdown */}
                    <div className="flex-1">
                      <Select
                        value={adj.metric_name}
                        onChange={(e) =>
                          updateAdjustment(
                            adj.id,
                            "metric_name",
                            e.target.value
                          )
                        }
                      >
                        <option value="">-- Select Metric --</option>
                        {/* Show current selection + available options */}
                        {adj.metric_name && (
                          <option value={adj.metric_name}>
                            {allMetrics.find((m) => m.key === adj.metric_name)
                              ?.label || adj.metric_name}
                          </option>
                        )}
                        {availableMetrics.map((m) => (
                          <option key={m.key} value={m.key}>
                            [{m.sectionLabel}] {m.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {/* Adjustment Slider */}
                    <div className="w-48">
                      <div className="flex items-center justify-between text-xs text-[rgb(var(--color-text-subtle))] mb-1">
                        <span>-100%</span>
                        <span
                          className={`font-bold ${
                            adj.adjustment_percent >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {adj.adjustment_percent >= 0 ? "+" : ""}
                          {adj.adjustment_percent}%
                        </span>
                        <span>+300%</span>
                      </div>
                      <input
                        type="range"
                        min={-100}
                        max={300}
                        step={5}
                        value={adj.adjustment_percent}
                        onChange={(e) =>
                          updateAdjustment(
                            adj.id,
                            "adjustment_percent",
                            parseInt(e.target.value)
                          )
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[rgb(var(--color-primary))]"
                      />
                    </div>

                    {/* Manual Input */}
                    <div className="w-24">
                      <input
                        type="number"
                        min={-100}
                        max={300}
                        value={adj.adjustment_percent}
                        onChange={(e) =>
                          updateAdjustment(
                            adj.id,
                            "adjustment_percent",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-2 py-1 text-sm text-center border border-[rgb(var(--color-border))] rounded"
                        placeholder="%"
                      />
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeAdjustment(adj.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSimulate}
              disabled={loading || !selectedTicker}
            >
              {loading ? "Calculating..." : "▶ Run Simulation"}
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              Reset
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </Card>

      {/* Results Card */}
      {result && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-bold text-[rgb(var(--color-text))] mb-4 flex items-center gap-2">
              📊 Simulation Results
            </h3>

            {/* Emiten Info */}
            <div className="mb-6 p-4 bg-[rgb(var(--color-surface))] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[rgb(var(--color-primary))] text-white flex items-center justify-center font-bold">
                  {result.ticker.substring(0, 2)}
                </div>
                <div>
                  <div className="font-bold text-lg">{result.ticker}</div>
                  <div className="text-sm text-[rgb(var(--color-text-subtle))]">
                    {result.ticker_name}
                  </div>
                </div>
              </div>
            </div>

            {/* Score Comparison */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-white rounded-lg border border-[rgb(var(--color-border))]">
                <div className="text-sm text-[rgb(var(--color-text-subtle))] mb-1">
                  Baseline Score ({result.baseline_year})
                </div>
                <div className="text-2xl font-bold text-[rgb(var(--color-primary))]">
                  {result.baseline_score.toFixed(2)}
                </div>
              </div>

              <div className="text-center p-4 bg-white rounded-lg border border-[rgb(var(--color-border))]">
                <div className="text-sm text-[rgb(var(--color-text-subtle))] mb-1">
                  Simulated Score ({result.simulation_year})
                </div>
                <div className="text-2xl font-bold text-[rgb(var(--color-action))]">
                  {result.simulated_score.toFixed(2)}
                </div>
              </div>

              <div className="text-center p-4 bg-white rounded-lg border border-[rgb(var(--color-border))]">
                <div className="text-sm text-[rgb(var(--color-text-subtle))] mb-1">
                  Change
                </div>
                <div
                  className={`text-2xl font-bold ${getDeltaColor(
                    result.delta
                  )}`}
                >
                  {formatDelta(result.delta)}
                </div>
                <div
                  className={`text-sm ${getDeltaColor(result.delta_percent)}`}
                >
                  ({formatDelta(result.delta_percent)}%)
                </div>
              </div>
            </div>

            {/* Adjustments Summary */}
            <div>
              <h4 className="font-semibold text-[rgb(var(--color-text))] mb-3">
                Applied Adjustments
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[rgb(var(--color-surface))]">
                      <th className="px-4 py-2 text-left">Metric</th>
                      <th className="px-4 py-2 text-right">Adjustment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments
                      .filter((a) => a.metric_name)
                      .map((a) => {
                        const metric = allMetrics.find(
                          (m) => m.key === a.metric_name
                        );
                        return (
                          <tr
                            key={a.id}
                            className="border-b border-[rgb(var(--color-border))]"
                          >
                            <td className="px-4 py-2">
                              <div className="font-medium">
                                {metric?.label || a.metric_name}
                              </div>
                              <div className="text-xs text-[rgb(var(--color-text-subtle))]">
                                {metric?.sectionLabel}
                              </div>
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-bold ${
                                a.adjustment_percent >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {a.adjustment_percent >= 0 ? "+" : ""}
                              {a.adjustment_percent}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-[rgb(var(--color-border))] flex gap-3">
              <Button variant="ghost" size="sm" disabled>
                📋 Save to Report (Coming Soon)
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Simulation;
