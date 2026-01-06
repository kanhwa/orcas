import { useState, useEffect } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  screenEmitens,
  getScreeningMetrics,
  getYears,
  ScreeningResponse,
  ScreeningMetric,
  MetricFilter,
  FilterOperator,
} from "../services/api";

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: ">", label: "> (lebih dari)" },
  { value: "<", label: "< (kurang dari)" },
  { value: ">=", label: ">= (minimal)" },
  { value: "<=", label: "<= (maksimal)" },
  { value: "=", label: "= (sama dengan)" },
  { value: "between", label: "between (antara)" },
];

interface FilterRow {
  id: number;
  metric_name: string;
  operator: FilterOperator;
  value: string;
  value_max: string;
}

export default function Screening() {
  const [metrics, setMetrics] = useState<ScreeningMetric[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [filters, setFilters] = useState<FilterRow[]>([
    { id: 1, metric_name: "", operator: ">", value: "", value_max: "" },
  ]);
  const [result, setResult] = useState<ScreeningResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load metrics and years
    getScreeningMetrics()
      .then(setMetrics)
      .catch(() => setError("Failed to load metrics"));
    getYears()
      .then((res) => {
        setYears(res.years);
        if (res.years.length > 0) setSelectedYear(res.years[0]);
      })
      .catch(() => setError("Failed to load years"));
  }, []);

  const addFilter = () => {
    const newId = Math.max(...filters.map((f) => f.id), 0) + 1;
    setFilters([
      ...filters,
      { id: newId, metric_name: "", operator: ">", value: "", value_max: "" },
    ]);
  };

  const removeFilter = (id: number) => {
    if (filters.length > 1) {
      setFilters(filters.filter((f) => f.id !== id));
    }
  };

  const updateFilter = (
    id: number,
    field: keyof FilterRow,
    value: string | FilterOperator
  ) => {
    setFilters(
      filters.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleScreen = async () => {
    // Validate filters
    const validFilters: MetricFilter[] = [];
    for (const f of filters) {
      if (!f.metric_name || !f.value) {
        setError("Semua filter harus diisi lengkap");
        return;
      }
      validFilters.push({
        metric_name: f.metric_name,
        operator: f.operator,
        value: parseFloat(f.value),
        value_max:
          f.operator === "between" && f.value_max
            ? parseFloat(f.value_max)
            : null,
      });
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await screenEmitens({
        year: selectedYear,
        filters: validFilters,
      });
      setResult(res);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Screening failed");
    } finally {
      setLoading(false);
    }
  };

  // Group metrics by section
  const metricsBySection = metrics.reduce((acc, m) => {
    if (!acc[m.section]) acc[m.section] = [];
    acc[m.section].push(m);
    return acc;
  }, {} as Record<string, ScreeningMetric[]>);

  const formatValue = (val: string | number): string => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold mb-4">🔍 Stock Screening</h2>
        <p className="text-gray-600 mb-4">
          Filter stocks based on metric criteria. All conditions must be met
          (AND logic).
        </p>

        {/* Year Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Data Year</label>
          <select
            className="w-full max-w-xs px-3 py-2 border rounded-md text-sm"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
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

              {/* Metric Select */}
              <select
                className="flex-1 min-w-[200px] px-3 py-2 border rounded-md text-sm"
                value={f.metric_name}
                onChange={(e) =>
                  updateFilter(f.id, "metric_name", e.target.value)
                }
              >
                <option value="">-- Select Metric --</option>
                {Object.entries(metricsBySection).map(([section, mets]) => (
                  <optgroup key={section} label={section.toUpperCase()}>
                    {mets.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
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
              <input
                type="number"
                className="w-32 px-3 py-2 border rounded-md text-sm"
                placeholder="Nilai"
                value={f.value}
                onChange={(e) => updateFilter(f.id, "value", e.target.value)}
              />

              {/* Max Value for Between */}
              {f.operator === "between" && (
                <>
                  <span className="text-sm text-gray-500">s.d.</span>
                  <input
                    type="number"
                    className="w-32 px-3 py-2 border rounded-md text-sm"
                    placeholder="Nilai Max"
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
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={addFilter} variant="secondary">
            + Tambah Filter
          </Button>
          <Button onClick={handleScreen} disabled={loading}>
            {loading ? "Processing..." : "🔍 Run Screening"}
          </Button>
        </div>

        {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <h3 className="text-lg font-bold mb-2">
            Screening Results: {result.total_matched} Stocks Passed
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Year {result.year} • {result.filters_applied} filters applied
          </p>

          {result.emitens.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Ticker</th>
                    <th className="px-4 py-2 text-left font-medium">Nama</th>
                    {filters
                      .filter((f) => f.metric_name)
                      .map((f) => (
                        <th
                          key={f.id}
                          className="px-4 py-2 text-right font-medium"
                        >
                          {f.metric_name}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {result.emitens.map((e, idx) => (
                    <tr key={e.ticker} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono font-bold">
                        {e.ticker}
                      </td>
                      <td className="px-4 py-2">{e.name}</td>
                      {filters
                        .filter((f) => f.metric_name)
                        .map((f) => (
                          <td key={f.id} className="px-4 py-2 text-right">
                            {formatValue(e.metrics[f.metric_name])}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No stocks match the filter criteria.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
