import { useState } from "react";
import {
  wsmScore,
  sectionRanking,
  User,
  WSMRankingItem,
  MetricsCatalog,
} from "../services/api";
import InfoTip from "../components/InfoTip";

interface DashboardProps {
  user: User;
  onLogout: () => void;
  catalog: MetricsCatalog | null;
}

type RankingMode = "overall" | "section";
type Section = "income" | "balance" | "cashflow";
type MissingPolicy = "zero" | "redistribute" | "drop";

const YEARS = Array.from({ length: 10 }, (_, i) => 2024 - i); // 2024 down to 2015

export default function Dashboard({
  user: _user,
  onLogout: _onLogout,
  catalog,
}: DashboardProps) {
  const [year, setYear] = useState(2023);
  const [mode, setMode] = useState<RankingMode>("section");
  const [section, setSection] = useState<Section>("income");
  const [missingPolicy, setMissingPolicy] = useState<MissingPolicy>("zero");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ranking, setRanking] = useState<WSMRankingItem[]>([]);

  // Silence unused variables (handled by App.tsx nav)
  void _user;
  void _onLogout;

  const handleRun = async () => {
    setError("");
    setLoading(true);
    setRanking([]);

    try {
      if (mode === "overall") {
        // Overall WSM with default metrics (ROA + ROE + Beban Usaha)
        const payload = {
          year,
          metrics: [
            {
              metric_name: "Return on Assets (ROA)",
              type: "benefit" as const,
              weight: 1,
            },
            {
              metric_name: "Return on Equity (ROE)",
              type: "benefit" as const,
              weight: 1,
            },
            { metric_name: "Beban Usaha", type: "cost" as const, weight: 1 },
          ],
          limit,
          missing_policy: missingPolicy,
        };
        if (import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG === "true") {
          console.log("[ORCAS] POST /api/wsm/score", payload);
        }
        const result = await wsmScore(payload);
        setRanking(result.ranking);
      } else {
        // Section Ranking
        const payload = {
          year,
          section,
          limit,
          missing_policy: missingPolicy,
        };
        if (import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG === "true") {
          console.log("[ORCAS] POST /api/wsm/section-ranking", payload);
        }
        const result = await sectionRanking(payload);
        setRanking(result.ranking);
      }
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string };
      setError(e.detail || "Failed to fetch ranking data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    _onLogout();
  };

  // Silence unused (kept for interface compatibility)
  void handleLogout;

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
      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📊 Bank Stock Ranking</h2>

          {/* Controls */}
          <div style={styles.controls}>
            <div style={styles.controlGroup}>
              <label style={styles.label}>Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
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
                onChange={(e) => setMode(e.target.value as RankingMode)}
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
                  <InfoTip content="Select which financial statement section to rank by." />
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
                Limit
                <InfoTip content="Maximum number of ranked tickers to display (1-32)." />
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                min={1}
                max={32}
                style={styles.input}
              />
            </div>

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

            <div style={styles.controlGroup}>
              <label style={styles.label}>&nbsp;</label>
              <button
                onClick={handleRun}
                disabled={loading}
                style={styles.runBtn}
              >
                {loading ? "Loading..." : "▶ Run"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p style={styles.error}>{error}</p>}

          {/* Results Table */}
          {ranking.length > 0 && (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Rank</th>
                    <th style={styles.th}>Ticker</th>
                    <th style={styles.th}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((item, index) => (
                    <tr
                      key={item.ticker}
                      style={index % 2 === 0 ? styles.trEven : {}}
                    >
                      <td style={styles.td}>{index + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>
                        {item.ticker}
                      </td>
                      <td style={styles.td}>{item.score.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!loading && ranking.length === 0 && !error && (
            <p style={styles.emptyState}>
              Select year, mode, and click "Run" to view ranking.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#f5f7fa",
  },
  main: {
    padding: "2rem",
    maxWidth: "900px",
    margin: "0 auto",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    margin: "0 0 1.5rem",
    fontSize: "1.25rem",
    color: "#1a1a2e",
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
    color: "#666",
    display: "flex",
    alignItems: "center",
  },
  select: {
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "#fff",
    cursor: "pointer",
  },
  input: {
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    width: "80px",
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
    margin: "0 0 1rem",
    padding: "0.75rem 1rem",
    background: "#fee",
    color: "#c00",
    borderRadius: "6px",
    fontSize: "0.85rem",
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
  },
  trEven: {
    background: "#f8f9fa",
  },
  emptyState: {
    textAlign: "center",
    color: "#888",
    padding: "2rem",
    margin: 0,
  },
};
