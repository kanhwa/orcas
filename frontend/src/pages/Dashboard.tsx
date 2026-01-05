import { useMemo, useState } from "react";
import {
  User,
  WSMRankingItem,
  sectionRanking,
  wsmScore,
} from "../services/api";
import InfoTip from "../components/InfoTip";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Slider } from "../components/ui/Slider";
import { Table } from "../components/ui/Table";
import { useCatalog } from "../contexts/CatalogContext";

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type RankingMode = "overall" | "section";
type Section = "income" | "balance" | "cashflow";
type MissingPolicy = "zero" | "redistribute" | "drop";

export default function Dashboard({
  user: _user,
  onLogout: _onLogout,
}: DashboardProps) {
  const {
    getSectionMeta,
    getModeOptions,
    getMissingPolicyOptions,
    getYearOptions,
    catalog,
  } = useCatalog();
  const [year, setYear] = useState(2023);
  const [mode, setMode] = useState<RankingMode>("section");
  const [section, setSection] = useState<Section>("income");
  const [missingPolicy, setMissingPolicy] = useState<MissingPolicy>("zero");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ranking, setRanking] = useState<WSMRankingItem[]>([]);

  void _user;
  void _onLogout;

  const years = getYearOptions();
  const sectionOptions = useMemo(() => catalog?.sections ?? [], [catalog]);
  const modeOptions = useMemo(() => getModeOptions(), [getModeOptions]);
  const missingPolicyOptions = useMemo(
    () => getMissingPolicyOptions(),
    [getMissingPolicyOptions]
  );

  const catalogReady =
    modeOptions.length > 0 &&
    sectionOptions.length > 0 &&
    missingPolicyOptions.length > 0;

  const handleRun = async () => {
    if (!catalogReady) {
      setError("Catalog is not loaded yet.");
      return;
    }
    setError("");
    setLoading(true);
    setRanking([]);

    try {
      if (mode === "overall") {
        const defaultMetrics =
          catalog?.sections.flatMap((s) =>
            s.metrics.filter((m) => m.key === "ROA" || m.key === "ROE")
          ) || [];
        const payload = {
          year,
          metrics: defaultMetrics.length
            ? defaultMetrics.map((m) => ({
                metric_name: m.label,
                type: "benefit" as const,
                weight: 1,
              }))
            : [
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
                {
                  metric_name: "Beban Usaha",
                  type: "cost" as const,
                  weight: 1,
                },
              ],
          limit,
          missing_policy: missingPolicy,
        };
        const result = await wsmScore(payload);
        setRanking(result.ranking);
      } else {
        const payload = {
          year,
          section,
          limit,
          missing_policy: missingPolicy,
        };
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

  return (
    <div className="space-y-4">
      <Card
        header={
          <div className="text-lg font-semibold text-[rgb(var(--color-text))]">
            Bank Stock Ranking
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Year
            </label>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
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
                  "Overall WSM uses default metric set; Section Ranking uses metrics from a chosen section."
                }
              />
            </label>
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as RankingMode)}
              disabled={!catalogReady}
            >
              {modeOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>

          {mode === "section" && (
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Section
                <InfoTip
                  content={
                    getSectionMeta(section)?.description ||
                    "Select which financial statement section to rank by."
                  }
                />
              </label>
              <Select
                value={section}
                onChange={(e) => setSection(e.target.value as Section)}
                disabled={!catalogReady}
              >
                {sectionOptions.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Missing Data Policy
              <InfoTip
                content={
                  getMissingPolicyOptions().find((p) => p.key === missingPolicy)
                    ?.description ||
                  "Zero: missing values = 0. Redistribute: share weights. Drop: exclude incomplete tickers."
                }
              />
            </label>
            <Select
              value={missingPolicy}
              onChange={(e) =>
                setMissingPolicy(e.target.value as MissingPolicy)
              }
              disabled={!catalogReady}
            >
              {missingPolicyOptions.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Slider
              label="Result limit"
              value={limit}
              min={1}
              max={32}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleRun}
              disabled={loading || !catalogReady}
              className="w-full md:w-auto"
            >
              {loading ? "Loading..." : "Run"}
            </Button>
          </div>
        </div>

        {error && (
          <p
            className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {ranking.length > 0 && (
          <div className="mt-6">
            <Table>
              <table>
                <thead>
                  <tr>
                    <th className="w-16">Rank</th>
                    <th>Ticker</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((item, index) => (
                    <tr key={item.ticker}>
                      <td>{index + 1}</td>
                      <td className="font-semibold">{item.ticker}</td>
                      <td>{item.score.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
          </div>
        )}

        {!loading && ranking.length === 0 && !error && (
          <p className="mt-4 text-center text-sm text-[rgb(var(--color-text-subtle))]">
            Select parameters and run to view ranking.
          </p>
        )}
      </Card>
    </div>
  );
}
