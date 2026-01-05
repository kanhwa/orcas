import React, { useState } from "react";
import {
  compare,
  CompareRequest,
  CompareResponse,
  MetricsCatalog,
} from "../services/api";
import InfoTip from "../components/InfoTip";

interface CompareProps {
  catalog: MetricsCatalog | null;
}

type Mode = "overall" | "section";
type Section = "income" | "balance" | "cashflow";
type MissingPolicy = "zero" | "redistribute" | "drop";

const AVAILABLE_TICKERS = [
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
];

const YEARS = Array.from({ length: 10 }, (_, i) => 2024 - i); // 2024 down to 2015

const Compare: React.FC<CompareProps> = ({ catalog }) => {
  // Form state
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [tickerInput, setTickerInput] = useState("");
  const [yearFrom, setYearFrom] = useState(2019);
  const [yearTo, setYearTo] = useState(2024);
  const [mode, setMode] = useState<Mode>("section");
  const [section, setSection] = useState<Section>("income");
  const [missingPolicy, setMissingPolicy] = useState<MissingPolicy>("zero");

  // Results state
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addTicker = (ticker: string) => {
    const upper = ticker.trim().toUpperCase();
    if (!upper) return;
    if (selectedTickers.length >= 4) {
      setError("Maximum 4 tickers");
      return;
    }
    if (selectedTickers.includes(upper)) {
      setError(`${upper} already selected`);
      return;
    }
    setSelectedTickers([...selectedTickers, upper]);
    setTickerInput("");
    setError(null);
  };

  const removeTicker = (ticker: string) => {
    setSelectedTickers(selectedTickers.filter((t) => t !== ticker));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    // Validation
    if (selectedTickers.length === 0) {
      setError("Select at least 1 ticker");
      return;
    }
    if (selectedTickers.length > 4) {
      setError("Maximum 4 tickers");
      return;
    }
    if (yearFrom > yearTo) {
      setError("Start year must be <= end year");
      return;
    }

    const payload: CompareRequest = {
      tickers: selectedTickers,
      year_from: yearFrom,
      year_to: yearTo,
      mode,
      section: mode === "section" ? section : null,
      missing_policy: missingPolicy,
    };

    if (import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG === "true") {
      console.log("[ORCAS] POST /api/wsm/compare", payload);
    }

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
          <h2 style={styles.cardTitle}>📈 Compare Tickers</h2>
          <p style={styles.subtitle}>
            Compare WSM scores for multiple tickers (max 4) across a year range.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Ticker Selection */}
            <div style={styles.section}>
              <label style={styles.label}>
                Select Tickers (1-4)
                <InfoTip content="Type a ticker symbol and press Enter or click Add. You can compare up to 4 tickers at once." />
              </label>
              <div style={styles.tickerInputRow}>
                <input
                  type="text"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTicker(tickerInput);
                    }
                  }}
                  placeholder="Type ticker then Enter"
                  style={styles.tickerInput}
                  list="ticker-suggestions"
                />
                <datalist id="ticker-suggestions">
                  {AVAILABLE_TICKERS.filter(
                    (t) => !selectedTickers.includes(t)
                  ).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => addTicker(tickerInput)}
                  style={styles.addBtn}
                  disabled={selectedTickers.length >= 4}
                >
                  + Add
                </button>
              </div>

              {/* Selected Tickers */}
              <div style={styles.selectedTickers}>
                {selectedTickers.map((ticker) => (
                  <span key={ticker} style={styles.tickerTag}>
                    {ticker}
                    <button
                      type="button"
                      onClick={() => removeTicker(ticker)}
                      style={styles.removeTagBtn}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {selectedTickers.length === 0 && (
                  <span style={styles.placeholder}>No tickers selected</span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div style={styles.controls}>
              <div style={styles.controlGroup}>
                <label style={styles.label}>Start Year</label>
                <select
                  value={yearFrom}
                  onChange={(e) => setYearFrom(Number(e.target.value))}
                  style={styles.select}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.controlGroup}>
                <label style={styles.label}>End Year</label>
                <select
                  value={yearTo}
                  onChange={(e) => setYearTo(Number(e.target.value))}
                  style={styles.select}
                >
                  {YEARS.map((y) => (
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
                  onChange={(e) => setMode(e.target.value as Mode)}
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
                    <InfoTip content="Select which financial statement section to compare." />
                  </label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value as Section)}
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
                    setMissingPolicy(e.target.value as MissingPolicy)
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || selectedTickers.length === 0}
              style={{
                ...styles.runBtn,
                opacity: loading || selectedTickers.length === 0 ? 0.6 : 1,
                cursor:
                  loading || selectedTickers.length === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {loading ? "Loading..." : "▶ Run Compare"}
            </button>
          </form>

          {/* Error */}
          {error && <p style={styles.error}>{error}</p>}

          {/* Results Table */}
          {result && (
            <div style={styles.resultsSection}>
              <h3 style={styles.resultsTitle}>Comparison Results</h3>
              <p style={styles.resultsSubtitle}>
                Mode:{" "}
                <strong>
                  {mode === "section" ? `Section (${section})` : "Overall WSM"}
                </strong>
                {" | "}
                Years:{" "}
                <strong>
                  {result.years[0]} - {result.years[result.years.length - 1]}
                </strong>
              </p>

              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Year</th>
                      {result.series.map((s) => (
                        <th key={s.ticker} style={styles.th}>
                          {s.ticker}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.years.map((year, yIdx) => (
                      <tr
                        key={year}
                        style={yIdx % 2 === 0 ? styles.trEven : {}}
                      >
                        <td style={styles.tdYear}>{year}</td>
                        {result.series.map((s) => {
                          const score = s.scores[yIdx];
                          const isMissing = s.missing_years.includes(year);
                          return (
                            <td
                              key={s.ticker}
                              style={{
                                ...styles.td,
                                color: isMissing ? "#999" : "#333",
                                fontStyle: isMissing ? "italic" : "normal",
                              }}
                            >
                              {formatScore(score)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Missing data note */}
              {result.series.some((s) => s.missing_years.length > 0) && (
                <p style={styles.missingNote}>
                  * "—" indicates data not available for that year
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Styles matching Dashboard & Simulation
const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#f5f7fa",
  },
  main: {
    padding: "2rem",
    maxWidth: "1000px",
    margin: "0 auto",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    margin: "0 0 0.5rem",
    fontSize: "1.25rem",
    color: "#1a1a2e",
  },
  subtitle: {
    color: "#666",
    marginBottom: "1.5rem",
  },
  section: {
    marginBottom: "1.5rem",
  },
  label: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#666",
    display: "flex",
    alignItems: "center",
    marginBottom: "0.25rem",
  },
  tickerInputRow: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.5rem",
  },
  tickerInput: {
    flex: 1,
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
  },
  addBtn: {
    padding: "0.6rem 1rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    background: "#28a745",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  selectedTickers: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    minHeight: "36px",
    alignItems: "center",
  },
  tickerTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.4rem 0.75rem",
    background: "#e9ecef",
    borderRadius: "20px",
    fontSize: "0.85rem",
    fontWeight: 600,
  },
  removeTagBtn: {
    background: "transparent",
    border: "none",
    color: "#666",
    fontSize: "1rem",
    cursor: "pointer",
    padding: "0 0.25rem",
    lineHeight: 1,
  },
  placeholder: {
    color: "#999",
    fontSize: "0.85rem",
    fontStyle: "italic",
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
    minWidth: "140px",
  },
  select: {
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "#fff",
    cursor: "pointer",
  },
  helperText: {
    fontSize: "0.7rem",
    color: "#888",
    marginTop: "0.25rem",
  },
  runBtn: {
    padding: "0.6rem 1.5rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    background: "#2563eb",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  error: {
    margin: "1rem 0",
    padding: "0.75rem 1rem",
    background: "#fee",
    color: "#c00",
    borderRadius: "6px",
    fontSize: "0.85rem",
  },
  resultsSection: {
    marginTop: "2rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid #e9ecef",
  },
  resultsTitle: {
    margin: "0 0 0.5rem",
    fontSize: "1.1rem",
    color: "#333",
  },
  resultsSubtitle: {
    color: "#666",
    fontSize: "0.9rem",
    marginBottom: "1rem",
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.9rem",
  },
  th: {
    textAlign: "left",
    padding: "0.75rem 1rem",
    background: "#f8f9fa",
    borderBottom: "2px solid #e9ecef",
    fontWeight: 600,
    color: "#495057",
  },
  td: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #e9ecef",
    textAlign: "right",
    fontFamily: "monospace",
  },
  tdYear: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #e9ecef",
    fontWeight: 600,
    color: "#333",
  },
  trEven: {
    background: "#f8f9fa",
  },
  missingNote: {
    marginTop: "1rem",
    fontSize: "0.8rem",
    color: "#666",
    fontStyle: "italic",
  },
};

export default Compare;
