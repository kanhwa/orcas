import React, { useState } from "react";
import {
  simulate,
  SimulationRequest,
  SimulationResponse,
  MetricOverride,
} from "../services/api";
import InfoTip from "../components/InfoTip";
import { useCatalog } from "../contexts/CatalogContext";

const Simulation: React.FC = () => {
  const {
    getSectionMeta,
    getModeOptions,
    getMissingPolicyOptions,
    getYearOptions,
  } = useCatalog();
  const {
    getSectionMeta,
    getModeOptions,
    getMissingPolicyOptions,
    getYearOptions,
  } = useCatalog();

  interface OverrideRow {
    id: number;
    metric_name: string;
    value: string;
  }

  // Form state
  const [ticker, setTicker] = useState("");
  const [year, setYear] = useState(2024);
  const [mode, setMode] = useState<"overall" | "section">("section");
  const [section, setSection] = useState<"cashflow" | "balance" | "income">(
    "cashflow"
  );
  const [missingPolicy, setMissingPolicy] = useState<
    "redistribute" | "zero" | "drop"
  >("redistribute");

  // Overrides state
  const [overrides, setOverrides] = useState<OverrideRow[]>([
    { id: 1, metric_name: "", value: "" },
    { id: 2, metric_name: "", value: "" },
    { id: 3, metric_name: "", value: "" },
  ]);
  const [nextId, setNextId] = useState(4);

  // Results state
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const years = getYearOptions();

  const addOverrideRow = () => {
    setOverrides([...overrides, { id: nextId, metric_name: "", value: "" }]);
    setNextId(nextId + 1);
  };

  const removeOverrideRow = (id: number) => {
    setOverrides(overrides.filter((o) => o.id !== id));
  };

  const updateOverride = (
    id: number,
    field: "metric_name" | "value",
    value: string
  ) => {
    setOverrides(
      overrides.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!ticker.trim()) {
      setError("Ticker is required");
      return;
    }

    // Filter valid overrides
    const validOverrides: MetricOverride[] = overrides
      .filter((o) => o.metric_name.trim() && o.value.trim())
      .map((o) => ({
        metric_name: o.metric_name.trim(),
        value: parseFloat(o.value),
      }))
      .filter((o) => !isNaN(o.value));

    const payload: SimulationRequest = {
      ticker: ticker.trim().toUpperCase(),
      year,
      mode,
      section: mode === "section" ? section : null,
      overrides: validOverrides,
      missing_policy: missingPolicy,
    };

    if (import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG === "true") {
      console.log("[ORCAS] POST /api/wsm/simulate", payload);
    }

    setLoading(true);
    try {
      const response = await simulate(payload);
      setResult(response);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (score?: number | null) => {
    if (score == null) return "N/A";
    return score.toFixed(4);
  };

  const formatDelta = (delta?: number | null) => {
    if (delta == null) return "N/A";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(4)}`;
  };

  const getDeltaColor = (delta?: number | null) => {
    if (delta == null) return "var(--text-subtle)";
    if (delta > 0) return "#2f7a4a";
    if (delta < 0) return "#b23c2f";
    return "var(--text-subtle)";
  };

  // Get options from catalog or fallback to defaults
  const modeOptions = catalog?.modes || [
    { key: "overall", label: "Overall WSM", description: "" },
    { key: "section", label: "Section Ranking", description: "" },
  ];

  const sectionOptions = catalog?.sections || [
    { key: "income", label: "Income Statement", description: "", metrics: [] },
    { key: "balance", label: "Balance Sheet", description: "", metrics: [] },
    { key: "cashflow", label: "Cash Flow", description: "", metrics: [] },
  ];

  const missingPolicyOptions = catalog?.missing_policy_options || [
    { key: "zero", label: "Zero (default)", description: "" },
    { key: "redistribute", label: "Redistribute", description: "" },
    { key: "drop", label: "Drop", description: "" },
  ];

  return (
    <div style={styles.container}>
      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📊 Simulation Scenario</h2>
          <p style={styles.subtitle}>
            Test how metric changes affect the WSM score for a specific ticker.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Basic Inputs */}
            <div style={styles.controls}>
              <div style={styles.controlGroup}>
                <label style={styles.label}>
                  Ticker
                  <InfoTip content="Enter the stock ticker symbol to simulate (e.g., BBCA)." />
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="e.g. BBCA"
                  style={styles.input}
                />
              </div>

              <div style={styles.controlGroup}>
                <label style={styles.label}>Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  style={styles.select}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.controlGroup}>
                <label style={styles.label}>
                  Mode
                  <InfoTip content="Overall WSM uses default metrics. Section Ranking uses all metrics from a specific section." />
                </label>
                <select
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value as "overall" | "section")
                  }
                  style={styles.select}
                >
                  {modeOptions.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {mode === "section" && (
                <div style={styles.controlGroup}>
                  <label style={styles.label}>
                    Section
                    <InfoTip content="Select which financial statement section to simulate." />
                  </label>
                  <select
                    value={section}
                    onChange={(e) =>
                      setSection(
                        e.target.value as "cashflow" | "balance" | "income"
                      )
                    }
                    style={styles.select}
                  >
                    {sectionOptions.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={styles.controlGroup}>
                <label style={styles.label}>
                  Missing Data Policy
                  <InfoTip content="Zero: missing values = 0. Redistribute: share weights. Drop: exclude incomplete tickers." />
                </label>
                <select
                  value={missingPolicy}
                  onChange={(e) =>
                    setMissingPolicy(
                      e.target.value as "redistribute" | "zero" | "drop"
                    )
                  }
                  style={styles.select}
                >
                  {missingPolicyOptions.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Metric Overrides */}
            <div style={styles.overridesSection}>
              <div style={styles.overridesHeader}>
                <label style={styles.label}>
                  Metric Overrides
                  <InfoTip content="Specify new values for metrics to simulate their impact. Leave blank to use actual values." />
                </label>
                <button
                  type="button"
                  onClick={addOverrideRow}
                  style={styles.addRowBtn}
                >
                  + Add Row
                </button>
              </div>

              <div style={styles.overridesTable}>
                {overrides.map((row) => (
                  <div key={row.id} style={styles.overrideRow}>
                    <input
                      type="text"
                      value={row.metric_name}
                      onChange={(e) =>
                        updateOverride(row.id, "metric_name", e.target.value)
                      }
                      placeholder="Metric name"
                      style={styles.overrideInput}
                    />
                    <input
                      type="number"
                      step="any"
                      value={row.value}
                      onChange={(e) =>
                        updateOverride(row.id, "value", e.target.value)
                      }
                      placeholder="Value"
                      style={styles.overrideInput}
                    />
                    {overrides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOverrideRow(row.id)}
                        style={styles.removeRowBtn}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.runBtn,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading..." : "▶ Run Simulation"}
            </button>
          </form>

          {/* Error */}
          {error && <p style={styles.error}>{error}</p>}

          {/* Results */}
          {result && (
            <div style={styles.resultsSection}>
              <h3 style={styles.resultsTitle}>Simulation Results</h3>
              <p style={styles.resultsSubtitle}>
                Ticker: <strong>{result.ticker}</strong> | Year:{" "}
                <strong>{result.year}</strong> | Mode:{" "}
                <strong>
                  {result.mode === "section"
                    ? `Section (${result.section})`
                    : "Overall WSM"}
                </strong>
              </p>

              <div style={styles.scoresGrid}>
                <div style={styles.scoreCard}>
                  <div style={styles.scoreLabel}>Baseline Score</div>
                  <div style={styles.scoreValue}>
                    {formatScore(result.baseline_score)}
                  </div>
                </div>

                <div style={styles.scoreCard}>
                  <div style={styles.scoreLabel}>Simulated Score</div>
                  <div style={styles.scoreValue}>
                    {formatScore(result.simulated_score)}
                  </div>
                </div>

                <div style={styles.scoreCard}>
                  <div style={styles.scoreLabel}>Delta</div>
                  <div
                    style={{
                      ...styles.scoreValue,
                      color: getDeltaColor(result.delta),
                    }}
                  >
                    {formatDelta(result.delta)}
                  </div>
                </div>
              </div>

              {result.applied_overrides &&
                result.applied_overrides.length > 0 && (
                  <div style={styles.appliedOverrides}>
                    <p style={styles.appliedOverridesTitle}>
                      Applied Overrides:
                    </p>
                    <ul style={styles.appliedOverridesList}>
                      {result.applied_overrides.map((override, idx) => (
                        <li key={idx} style={styles.appliedOverrideItem}>
                          <strong>{override.metric_name}</strong> ={" "}
                          {override.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {result.message && (
                <p style={styles.resultMessage}>{result.message}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "var(--surface)",
  },
  main: {
    padding: "2rem",
    maxWidth: "900px",
    margin: "0 auto",
  },
  card: {
    background: "var(--card-bg)",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "var(--card-shadow)",
  },
  cardTitle: {
    margin: "0 0 0.5rem",
    fontSize: "1.25rem",
    color: "var(--accent-1)",
  },
  subtitle: {
    color: "var(--text-subtle)",
    marginBottom: "1.5rem",
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    minWidth: "120px",
  },
  label: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--text-subtle)",
    display: "flex",
    alignItems: "center",
  },
  input: {
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid var(--border)",
    borderRadius: "6px",
  },
  select: {
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    background: "#fff",
    cursor: "pointer",
  },
  overridesSection: {
    marginBottom: "1.5rem",
  },
  overridesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  addRowBtn: {
    padding: "0.4rem 0.75rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#fff",
    background: "var(--action)",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  overridesTable: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  overrideRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  overrideInput: {
    flex: 1,
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid var(--border)",
    borderRadius: "6px",
  },
  removeRowBtn: {
    width: "32px",
    height: "32px",
    fontSize: "1.25rem",
    color: "var(--text-subtle)",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  runBtn: {
    padding: "0.6rem 1.5rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    background: "var(--action)",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  error: {
    margin: "1rem 0",
    padding: "0.75rem 1rem",
    background: "#fff6f6",
    color: "#a83232",
    borderRadius: "6px",
    fontSize: "0.85rem",
  },
  resultsSection: {
    marginTop: "2rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid var(--border)",
  },
  resultsTitle: {
    margin: "0 0 0.5rem",
    fontSize: "1.1rem",
    color: "var(--accent-1)",
  },
  resultsSubtitle: {
    color: "var(--text-subtle)",
    fontSize: "0.9rem",
    marginBottom: "1.5rem",
  },
  scoresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  scoreCard: {
    padding: "1rem",
    background: "var(--table-header)",
    borderRadius: "8px",
    textAlign: "center",
  },
  scoreLabel: {
    fontSize: "0.8rem",
    color: "var(--text-subtle)",
    marginBottom: "0.5rem",
  },
  scoreValue: {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "var(--accent-1)",
    fontFamily: "monospace",
  },
  appliedOverrides: {
    padding: "1rem",
    background: "var(--table-header)",
    borderRadius: "8px",
    marginBottom: "1rem",
  },
  appliedOverridesTitle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--text-subtle)",
    margin: "0 0 0.5rem",
  },
  appliedOverridesList: {
    margin: 0,
    paddingLeft: "1.25rem",
  },
  appliedOverrideItem: {
    fontSize: "0.85rem",
    color: "var(--text-main)",
    marginBottom: "0.25rem",
  },
  resultMessage: {
    fontSize: "0.85rem",
    color: "var(--text-subtle)",
    fontStyle: "italic",
    margin: 0,
  },
};

export default Simulation;
