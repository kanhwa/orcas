import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Table } from "../components/ui/Table";
import { Toggle } from "../components/ui/Toggle";
import InfoTip from "../components/InfoTip";

type MissingPolicy = "redistribute" | "zero" | "drop";
type Tab = "ranking" | "scorecard";

type WeightEntry = {
  metric_name: string;
  weight: number;
};

const BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw { status: response.status, detail: body.detail || "Unknown error" };
  }
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function getYears(): Promise<{ years: number[] }> {
  return request<{ years: number[] }>("/api/years", { method: "GET" });
}

async function getEmitens(): Promise<{ items: EmitenItem[] }> {
  return request<{ items: EmitenItem[] }>("/api/emitens", { method: "GET" });
}

let cachedMissingPolicies: MissingPolicyOption[] | null = null;

async function getMetricsCatalog(): Promise<MetricsCatalog> {
  const res = await request<MetricsCatalog>("/api/wsm/metrics-catalog", {
    method: "GET",
  });
  cachedMissingPolicies = res.missing_policy_options || null;
  return res;
}

function getMissingPolicyOptions(): MissingPolicyOption[] | null {
  return cachedMissingPolicies;
}

async function wsmScorePreview(
  payload: WSMScoreRequest
): Promise<WSMScorePreviewResponse> {
  return request<WSMScorePreviewResponse>("/api/wsm/score-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function wsmScore(payload: WSMScoreRequest): Promise<void> {
  await request<void>("/api/wsm/score", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function wsmScorecard(payload: {
  year: number;
  ticker: string;
  missing_policy: MissingPolicy;
}): Promise<ScorecardResponse> {
  return request<ScorecardResponse>("/api/wsm/scorecard", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

type EmitenItem = {
  ticker_code: string;
  bank_name: string | null;
};

type MetricInfo = {
  key: string;
  label: string;
  description: string;
  type?: "benefit" | "cost" | null;
  default_weight?: number | null;
};

type SectionInfo = {
  key: string;
  label: string;
  description: string;
  metrics: MetricInfo[];
};

type MissingPolicyOption = {
  key: MissingPolicy;
  label: string;
  description: string;
};

type MetricsCatalog = {
  sections: SectionInfo[];
  missing_policy_options: MissingPolicyOption[];
};

type MetricWeightInput = {
  metric_name: string;
  type: "benefit" | "cost";
  weight: number;
};

type CoverageSummary = {
  used: number;
  total: number;
  pct: number;
  missing?: string[];
};

type WSMRankingPreviewItem = {
  rank: number;
  ticker: string;
  score: number;
  coverage: CoverageSummary;
  confidence: "High" | "Medium" | "Low";
};

type WSMScorePreviewResponse = {
  year: number;
  missing_policy: MissingPolicy;
  ranking: WSMRankingPreviewItem[];
  tie_breaker: string[];
};

type WSMScoreRequest = {
  year: number;
  metrics: MetricWeightInput[];
  tickers?: string[] | null;
  limit?: number | null;
  missing_policy?: MissingPolicy;
};

type ScorecardCoverage = {
  used: number;
  total: number;
  pct: number;
  missing: string[];
};

type ScorecardSectionSubtotals = {
  balance: number;
  income: number;
  cash_flow: number;
};

type ScorecardMetric = {
  metric_name: string;
  section: "balance" | "income" | "cash_flow";
  type: "benefit" | "cost";
  display_unit: string;
  allow_negative?: boolean;
  raw_value: number | null;
  normalized_value: number;
  weight: number;
  contribution: number;
  is_missing?: boolean;
};

type ScorecardResponse = {
  year: number;
  ticker: string;
  total_score: number;
  rank: number;
  coverage: ScorecardCoverage;
  confidence: "High" | "Medium" | "Low";
  section_breakdown?: unknown[];
  section_subtotals: ScorecardSectionSubtotals;
  tie_breaker?: string[];
  metrics: ScorecardMetric[];
};

const DROP_POLICY_MESSAGE =
  "Drop policy requires full data coverage (39/39). Choose a ticker with 100% coverage or switch policy.";

const DEFAULT_MISSING_POLICY_OPTIONS: MissingPolicyOption[] = [
  {
    key: "zero",
    label: "Zero",
    description: "Treat missing as zero",
  },
  {
    key: "redistribute",
    label: "Redistribute",
    description: "Redistribute weights",
  },
  { key: "drop", label: "Drop", description: "Skip if missing" },
];

const SECTION_LABELS: Record<ScorecardMetric["section"], string> = {
  balance: "Balance",
  income: "Income",
  cash_flow: "Cash Flow",
};

function formatDecimal(value: number | null | undefined, digits = 6): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function asPercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value <= 1) return value * 100;
  return value;
}

function normalizeWeights(entries: WeightEntry[], fallback: WeightEntry[]) {
  const total = entries.reduce((acc, cur) => acc + (cur.weight || 0), 0);
  if (total <= 0) {
    return {
      normalized: fallback,
      note: "Weights reset to defaults because sum was zero.",
    };
  }
  const normalized = entries.map((e) => ({ ...e, weight: e.weight / total }));
  return { normalized, note: "Weights normalized to sum to 1." };
}

function buildOfficialMetrics(
  sections: { metrics: MetricInfo[] }[]
): MetricWeightInput[] {
  const metrics: MetricWeightInput[] = [];
  sections.forEach((section) => {
    section.metrics.forEach((m) => {
      if (m.default_weight === null || m.default_weight === undefined) return;
      if (!m.type) return;
      metrics.push({
        metric_name: m.key,
        type: m.type,
        weight: m.default_weight,
      });
    });
  });
  return metrics;
}

const Scoring = () => {
  const [tab, setTab] = useState<Tab>("ranking");
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [emitens, setEmitens] = useState<EmitenItem[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [metrics, setMetrics] = useState<MetricWeightInput[]>([]);
  const [ranking, setRanking] = useState<WSMRankingPreviewItem[]>([]);
  const [rankingError, setRankingError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [missingPolicy, setMissingPolicy] = useState<MissingPolicy>("zero");
  const [rankingPolicyUsed, setRankingPolicyUsed] =
    useState<MissingPolicy>("zero");
  const [dropEligibleByYear, setDropEligibleByYear] = useState<
    Record<number, string[]>
  >({});
  const [dropEligibilityLoadingYear, setDropEligibilityLoadingYear] = useState<
    number | null
  >(null);
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [scorecardError, setScorecardError] = useState("");

  const [useCustomWeights, setUseCustomWeights] = useState(false);
  const [customWeights, setCustomWeights] = useState<WeightEntry[]>([]);
  const [normalizationNote, setNormalizationNote] = useState("");

  useEffect(() => {
    const loadEmitens = async () => {
      try {
        const res = await getEmitens();
        setEmitens(res.items || []);
        if (!selectedTicker && res.items?.length) {
          setSelectedTicker(res.items[0].ticker_code);
        }
      } catch (err) {
        console.warn("Failed to load emitens list", err);
      }
    };
    loadEmitens();
  }, [selectedTicker]);

  useEffect(() => {
    const loadYears = async () => {
      try {
        const res = await getYears();
        setYears(res.years || []);
        if (!selectedYear && res.years?.length) {
          setSelectedYear(res.years[0]);
        }
      } catch (err) {
        console.warn("Failed to load years", err);
      }
    };
    loadYears();
  }, [selectedYear]);

  useEffect(() => {
    const loadMetrics = async () => {
      setLoadingMeta(true);
      try {
        const catalog = await getMetricsCatalog();
        const officialMetrics = buildOfficialMetrics(catalog.sections);
        setMetrics(officialMetrics);
      } catch (err) {
        const e = err as { detail?: string };
        setRankingError(e.detail || "Failed to load metrics catalog");
      } finally {
        setLoadingMeta(false);
      }
    };
    loadMetrics();
  }, []);

  useEffect(() => {
    if (!scorecard) return;
    const defaults: WeightEntry[] = scorecard.metrics.map((m) => ({
      metric_name: m.metric_name,
      weight: m.weight,
    }));
    const normalized = normalizeWeights(defaults, defaults);
    setCustomWeights(normalized.normalized);
    setUseCustomWeights(false);
    setNormalizationNote("");
  }, [scorecard]);

  const ensureDropEligibleTickers = useCallback(
    async (year: number): Promise<string[]> => {
      if (dropEligibleByYear[year]) return dropEligibleByYear[year];
      if (!metrics.length) return [];
      setDropEligibilityLoadingYear(year);
      try {
        const result = await wsmScorePreview({
          year,
          metrics,
          missing_policy: "drop",
        });
        const tickers = result.ranking?.map((r) => r.ticker) ?? [];
        setDropEligibleByYear((prev) => ({ ...prev, [year]: tickers }));
        return tickers;
      } catch (err) {
        console.warn("Failed to fetch drop-eligible tickers", err);
        return [];
      } finally {
        setDropEligibilityLoadingYear((prev) => (prev === year ? null : prev));
      }
    },
    [dropEligibleByYear, metrics]
  );

  useEffect(() => {
    if (missingPolicy !== "drop") return;
    if (!selectedYear || !metrics.length) return;
    let cancelled = false;
    const year = Number(selectedYear);
    ensureDropEligibleTickers(year).then((tickers) => {
      if (cancelled) return;
      if (!tickers.length) {
        if (selectedTicker) setSelectedTicker("");
        return;
      }
      if (!tickers.includes(selectedTicker)) {
        setSelectedTicker(tickers[0]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ensureDropEligibleTickers, missingPolicy, selectedTicker, selectedYear]);

  const canRun = useMemo(
    () => !!selectedYear && metrics.length > 0 && !loadingMeta,
    [selectedYear, metrics.length, loadingMeta]
  );

  const dropEligibleTickers = useMemo(
    () =>
      selectedYear && typeof selectedYear === "number"
        ? dropEligibleByYear[Number(selectedYear)]
        : undefined,
    [dropEligibleByYear, selectedYear]
  );

  const isDropPolicy = missingPolicy === "drop";

  const dropSelectionNeedsAttention =
    isDropPolicy &&
    dropEligibleTickers !== undefined &&
    (!dropEligibleTickers.length ||
      !selectedTicker ||
      (selectedTicker && !dropEligibleTickers.includes(selectedTicker)));

  const missingPolicyOptions =
    getMissingPolicyOptions() || DEFAULT_MISSING_POLICY_OPTIONS;

  const handleRun = async () => {
    if (!selectedYear) return;
    if (!metrics.length) {
      setRankingError("Metrics are not available yet.");
      return;
    }
    setSaveMessage("");
    setRankingError("");
    setLoading(true);
    setRanking([]);
    setRankingPolicyUsed(missingPolicy);
    try {
      const result = await wsmScorePreview({
        year: Number(selectedYear),
        metrics,
        missing_policy: missingPolicy,
      });
      if (missingPolicy === "drop") {
        setDropEligibleByYear((prev) => ({
          ...prev,
          [Number(selectedYear)]: result.ranking?.map((r) => r.ticker) ?? [],
        }));
      }
      setRanking(result.ranking || []);
    } catch (err) {
      const e = err as { detail?: string };
      setRankingError(e.detail || "Failed to fetch scoring results");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRun = async () => {
    if (!selectedYear) return;
    if (!metrics.length) {
      setRankingError("Metrics are not available yet.");
      return;
    }
    setSaveMessage("");
    setSaving(true);
    try {
      await wsmScore({
        year: Number(selectedYear),
        metrics,
        missing_policy: rankingPolicyUsed,
      });
      setSaveMessage("Saved to reports.");
    } catch (err) {
      const e = err as { detail?: string };
      setRankingError(e.detail || "Failed to save scoring run");
    } finally {
      setSaving(false);
    }
  };

  const scorecardFallbackWeights = useMemo<WeightEntry[]>(
    () =>
      scorecard
        ? scorecard.metrics.map((m) => ({
            metric_name: m.metric_name,
            weight: m.weight,
          }))
        : [],
    [scorecard]
  );

  const handleLoadScorecard = async (opts?: {
    year?: number;
    ticker?: string;
    missingPolicy?: MissingPolicy;
  }) => {
    const year = opts?.year ?? selectedYear;
    const ticker = opts?.ticker ?? selectedTicker;
    if (!year || !ticker) {
      setScorecardError("Select a year and ticker first.");
      return;
    }
    const policy = opts?.missingPolicy ?? missingPolicy;
    if (opts?.missingPolicy && opts.missingPolicy !== missingPolicy) {
      setMissingPolicy(opts.missingPolicy);
    }
    if (opts?.year) setSelectedYear(opts.year);
    if (opts?.ticker) setSelectedTicker(opts.ticker);
    setScorecardError("");
    setScorecard(null);
    const resolvedYear = Number(year);
    if (policy === "drop") {
      const eligible = await ensureDropEligibleTickers(resolvedYear);
      if (!eligible.length) {
        setScorecardError(DROP_POLICY_MESSAGE);
        return;
      }
      if (!eligible.includes(ticker)) {
        const nextTicker = eligible[0] ?? "";
        setSelectedTicker(nextTicker);
        setScorecardError(DROP_POLICY_MESSAGE);
        return;
      }
    }
    setScorecardLoading(true);
    try {
      const result = await wsmScorecard({
        year: resolvedYear,
        ticker,
        missing_policy: policy,
      });
      setScorecard(result);
    } catch (err) {
      const e = err as { detail?: string };
      const detail = e.detail || "Failed to load scorecard";
      const detailLower = detail.toLowerCase();
      if (
        policy === "drop" &&
        (detailLower.includes("missing_policy") ||
          detailLower.includes("does not satisfy"))
      ) {
        setScorecardError(DROP_POLICY_MESSAGE);
      } else {
        setScorecardError(detail);
      }
    } finally {
      setScorecardLoading(false);
    }
  };

  const handleCustomWeightChange = (metricName: string, rawValue: string) => {
    const parsed = parseFloat(rawValue);
    setCustomWeights((prev) => {
      const updated = prev.map((w) =>
        w.metric_name === metricName ? { ...w, weight: parsed } : w
      );
      const normalized = normalizeWeights(updated, scorecardFallbackWeights);
      setNormalizationNote(normalized.note);
      return normalized.normalized;
    });
  };

  const handleNormalizeClick = () => {
    const normalized = normalizeWeights(
      customWeights,
      scorecardFallbackWeights
    );
    setCustomWeights(normalized.normalized);
    setNormalizationNote(normalized.note || "Weights normalized to sum to 1.");
  };

  const handleResetWeights = () => {
    const normalized = normalizeWeights(
      scorecardFallbackWeights,
      scorecardFallbackWeights
    );
    setCustomWeights(normalized.normalized);
    setNormalizationNote("Reset to default weights.");
  };

  const whatIf = useMemo(() => {
    if (!scorecard || !useCustomWeights) return null;
    const weightMap = new Map(
      customWeights.map((w) => [w.metric_name, w.weight])
    );
    const perMetric = scorecard.metrics.map((m) => {
      const weight = weightMap.get(m.metric_name) ?? 0;
      const normalizedValue = m.normalized_value ?? 0;
      const contribution = weight * normalizedValue;
      return { metric_name: m.metric_name, contribution };
    });
    const total = perMetric.reduce((acc, cur) => acc + cur.contribution, 0);
    const delta = total - (scorecard?.total_score ?? 0);
    const contributionMap = new Map(
      perMetric.map((p) => [p.metric_name, p.contribution])
    );
    return { total, delta, contributionMap };
  }, [customWeights, scorecard, useCustomWeights]);

  const confidenceLabel = useMemo(() => {
    if (!scorecard) return "";
    return scorecard.confidence || "";
  }, [scorecard]);

  const confidenceTone =
    confidenceLabel === "High"
      ? "bg-green-100 text-green-800"
      : confidenceLabel === "Medium"
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";

  const renderTabs = () => (
    <div className="flex border-b border-[rgb(var(--color-border))]">
      {(
        [
          {
            key: "ranking",
            label: "Ranking",
            icon: "🏅",
            tip: "Official ranking preview",
          },
          {
            key: "scorecard",
            label: "Scorecard",
            icon: "📊",
            tip: "Per-metric breakdown",
          },
        ] as { key: Tab; label: string; icon: string; tip: string }[]
      ).map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setTab(t.key)}
          className={`relative px-5 py-3 text-sm font-medium transition-colors ${
            tab === t.key
              ? "text-[rgb(var(--color-primary))]"
              : "text-[rgb(var(--color-text-subtle))] hover:text-[rgb(var(--color-text))]"
          }`}
        >
          <span className="flex items-center gap-2">
            <span>{t.icon}</span>
            {t.label}
            <InfoTip content={t.tip} />
          </span>
          {tab === t.key && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary))]" />
          )}
        </button>
      ))}
    </div>
  );

  const renderRankingTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[rgb(var(--color-text-subtle))]">
              Year
            </span>
            <Select
              value={selectedYear ?? ""}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-32"
              disabled={loadingMeta}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[rgb(var(--color-text-subtle))]">
              Missing Data Policy
            </span>
            <Select
              value={missingPolicy}
              onChange={(e) =>
                setMissingPolicy(e.target.value as MissingPolicy)
              }
              className="w-40"
              disabled={loadingMeta}
            >
              {missingPolicyOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={handleRun} disabled={!canRun || loading}>
            {loading ? "Running..." : "Run Scoring"}
          </Button>
        </div>
        <p className="text-xs text-[rgb(var(--color-text-subtle))]">
          Official scoring uses default weights; missing metrics follow the
          selected policy.
        </p>
      </div>

      {loading && <p className="text-gray-500">Loading ranking...</p>}
      {!loading && rankingError && (
        <p className="text-red-500">{rankingError}</p>
      )}
      {!loading && !rankingError && ranking.length === 0 && (
        <p className="text-gray-500">
          No results yet. Choose a year and run scoring.
        </p>
      )}
      {!loading && ranking.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveRun}
                disabled={saving}
                variant="secondary"
              >
                {saving ? "Saving..." : "Save to report"}
              </Button>
              {saveMessage && (
                <span className="text-xs text-green-700">{saveMessage}</span>
              )}
            </div>
            <p className="text-xs text-[rgb(var(--color-text-subtle))]">
              Preview uses default weights; save to persist in Reports.
            </p>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Ticker</th>
                <th>Total Score</th>
                <th>Coverage</th>
                <th>Confidence</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((item, idx) => {
                const coveragePct = asPercent(item.coverage?.pct ?? null);
                const coverageLabel =
                  coveragePct === null || coveragePct === undefined
                    ? "—"
                    : `${formatDecimal(coveragePct, 1)}%`;
                const confidence = item.confidence || "";
                const confidenceToneRow =
                  confidence === "High"
                    ? "bg-green-100 text-green-800"
                    : confidence === "Medium"
                    ? "bg-amber-100 text-amber-800"
                    : confidence === "Low"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-600";
                return (
                  <tr key={`${item.ticker}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td className="font-mono">{item.ticker}</td>
                    <td>{formatDecimal(item.score, 6)}</td>
                    <td>{coverageLabel}</td>
                    <td>
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${confidenceToneRow}`}
                      >
                        {confidence || "—"}
                      </span>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setTab("scorecard");
                          handleLoadScorecard({
                            year: Number(selectedYear) || years[0],
                            ticker: item.ticker,
                            missingPolicy: rankingPolicyUsed,
                          });
                        }}
                      >
                        View details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </>
      )}
      <p className="text-xs text-[rgb(var(--color-text-subtle))]">
        Scores are normalized within the selected year (0–1). This is not a
        forecast.
      </p>
    </div>
  );

  const renderScorecardSummary = () => {
    if (!scorecard) return null;
    const coveragePct = asPercent(scorecard.coverage?.pct ?? null) ?? 0;
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3">
          <div className="text-xs text-[rgb(var(--color-text-subtle))]">
            Rank
          </div>
          <div className="text-lg font-semibold">{scorecard.rank ?? "—"}</div>
          <div className="text-xs text-[rgb(var(--color-text-subtle))]">
            Official scoring
          </div>
        </div>
        <div className="rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3">
          <div className="text-xs text-[rgb(var(--color-text-subtle))]">
            Total Score
          </div>
          <div className="text-lg font-semibold">
            {formatDecimal(scorecard.total_score)}
          </div>
          <div className="text-xs text-[rgb(var(--color-text-subtle))]">
            0–1 normalized
          </div>
        </div>
        <div className="rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3">
          <div className="text-xs text-[rgb(var(--color-text-subtle))]">
            Coverage
          </div>
          <div className="text-lg font-semibold">
            {formatDecimal(coveragePct, 1)}% ({scorecard.coverage?.used ?? 0}/
            {scorecard.coverage?.total ?? 0})
          </div>
          <div className="text-xs text-[rgb(var(--color-text-subtle))]">
            Missing policy: {missingPolicy}
          </div>
        </div>
        <div className="rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3 flex items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${confidenceTone}`}
          >
            {scorecard.confidence}
          </span>
          <span className="text-xs text-[rgb(var(--color-text-subtle))]">
            High ≥ 90%, Medium 75–89%
          </span>
        </div>
      </div>
    );
  };

  const renderSectionSubtotals = () => {
    if (!scorecard) return null;
    const contributionBySection: Record<
      keyof ScorecardSectionSubtotals,
      number
    > = {
      balance: 0,
      income: 0,
      cash_flow: 0,
    };
    scorecard.metrics.forEach((m) => {
      contributionBySection[m.section] += m.contribution ?? 0;
    });
    const totalContribution = Object.values(contributionBySection).reduce(
      (acc, cur) => acc + cur,
      0
    );
    const entries: {
      key: keyof ScorecardSectionSubtotals;
      label: string;
      score: number;
    }[] = [
      {
        key: "balance",
        label: "Balance",
        score: scorecard.section_subtotals.balance,
      },
      {
        key: "income",
        label: "Income",
        score: scorecard.section_subtotals.income,
      },
      {
        key: "cash_flow",
        label: "Cash Flow",
        score: scorecard.section_subtotals.cash_flow,
      },
    ];
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {entries.map((entry) => {
          const share =
            totalContribution > 0
              ? contributionBySection[entry.key] / totalContribution
              : 0;
          return (
            <div
              key={entry.key}
              className="rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[rgb(var(--color-text-subtle))]">
                    {entry.label}
                  </div>
                  <div className="text-lg font-semibold">
                    {formatDecimal(entry.score)}
                  </div>
                </div>
                <div className="text-right text-xs text-[rgb(var(--color-text-subtle))]">
                  Eff. weight
                  <div className="font-semibold text-[rgb(var(--color-text))]">
                    {formatDecimal(share * 100, 1)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeightsPanel = () => {
    if (!scorecard || !scorecard.metrics.length) return null;
    return (
      <div className="space-y-2 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle
            pressed={useCustomWeights}
            onChange={(next) => {
              setUseCustomWeights(next);
              setNormalizationNote("");
              if (next) handleNormalizeClick();
            }}
            label="Use custom weights (what-if)"
          />
          {useCustomWeights && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleNormalizeClick}
              >
                Normalize to 1
              </Button>
              <Button size="sm" variant="ghost" onClick={handleResetWeights}>
                Reset to default
              </Button>
            </div>
          )}
        </div>
        {useCustomWeights && (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="w-40">Weight</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.metrics.map((m) => {
                  const weightEntry = customWeights.find(
                    (w) => w.metric_name === m.metric_name
                  );
                  return (
                    <tr key={`weight-${m.metric_name}`}>
                      <td>{m.metric_name}</td>
                      <td>
                        <input
                          type="number"
                          step="0.000001"
                          min={0}
                          value={weightEntry?.weight ?? 0}
                          onChange={(e) =>
                            handleCustomWeightChange(
                              m.metric_name,
                              e.target.value
                            )
                          }
                          className="w-full rounded border border-[rgb(var(--color-border))] px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {normalizationNote && (
              <p className="text-xs text-[rgb(var(--color-text-subtle))]">
                {normalizationNote}
              </p>
            )}
            {whatIf && (
              <p className="text-sm text-[rgb(var(--color-text))]">
                What-if score: {formatDecimal(whatIf.total)} (Δ vs default:{" "}
                {whatIf.delta >= 0 ? "+" : ""}
                {formatDecimal(whatIf.delta)}) — rank is not recomputed for
                what-if weights.
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  const renderFlags = (m: ScorecardMetric) => {
    const flags: string[] = [];
    const isMissing =
      m.raw_value === null ||
      m.raw_value === undefined ||
      Number.isNaN(m.raw_value) ||
      (m as { is_missing?: boolean }).is_missing;
    if (isMissing) flags.push("MISSING");
    if (!isMissing && typeof m.raw_value === "number" && m.raw_value < 0)
      flags.push("NEGATIVE");
    if (!flags.length) return "—";
    return (
      <span className="inline-flex flex-wrap gap-1">
        {flags.map((f) => (
          <span
            key={`${m.metric_name}-${f}`}
            className="inline-block rounded bg-[rgb(var(--color-border))] px-2 py-0.5 text-[10px] font-semibold uppercase text-[rgb(var(--color-text))]"
          >
            {f}
          </span>
        ))}
      </span>
    );
  };

  const renderScorecardTable = () => {
    if (!scorecard) return null;
    const rows = scorecard.metrics;
    return (
      <Table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Section</th>
            <th>Type</th>
            <th>Raw Value</th>
            <th>Normalized</th>
            <th>Default Weight</th>
            <th>Contribution</th>
            {useCustomWeights && <th>What-if Contribution</th>}
            <th>Unit</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const whatIfContribution = whatIf?.contributionMap.get(
              m.metric_name
            );
            return (
              <tr key={`${m.metric_name}-${m.section}`}>
                <td>{m.metric_name}</td>
                <td>{SECTION_LABELS[m.section]}</td>
                <td className="capitalize">{m.type}</td>
                <td>
                  {m.raw_value === null ? "—" : formatDecimal(m.raw_value, 4)}
                </td>
                <td>{formatDecimal(m.normalized_value)}</td>
                <td>{formatDecimal(m.weight)}</td>
                <td>{formatDecimal(m.contribution)}</td>
                {useCustomWeights && (
                  <td>{formatDecimal(whatIfContribution)}</td>
                )}
                <td>{m.display_unit || "—"}</td>
                <td>{renderFlags(m)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  const renderScorecardTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[rgb(var(--color-text-subtle))]">
            Year
          </span>
          <Select
            value={selectedYear ?? ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[rgb(var(--color-text-subtle))]">
            Ticker
          </span>
          <Select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="w-full"
          >
            {emitens.map((item) => {
              const isEligible = !isDropPolicy
                ? true
                : dropEligibleTickers
                ? dropEligibleTickers.includes(item.ticker_code)
                : true;
              return (
                <option
                  key={item.ticker_code}
                  value={item.ticker_code}
                  disabled={
                    isDropPolicy && dropEligibleTickers ? !isEligible : false
                  }
                >
                  {item.ticker_code}
                </option>
              );
            })}
          </Select>
          {isDropPolicy && (
            <div className="space-y-1">
              <p className="text-[11px] text-[rgb(var(--color-text-subtle))]">
                Drop policy requires full coverage (39/39). Ineligible tickers
                are disabled.
                {dropEligibilityLoadingYear ===
                (typeof selectedYear === "number" ? selectedYear : null)
                  ? " Checking eligibility..."
                  : ""}
              </p>
              {dropSelectionNeedsAttention && (
                <p className="text-[11px] text-[rgb(var(--color-text-subtle))]">
                  {DROP_POLICY_MESSAGE}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[rgb(var(--color-text-subtle))]">
            Missing Data Policy
          </span>
          <Select
            value={missingPolicy}
            onChange={(e) => setMissingPolicy(e.target.value as MissingPolicy)}
            className="w-full"
          >
            {missingPolicyOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-transparent">Load</span>
          <Button
            onClick={() => handleLoadScorecard()}
            disabled={scorecardLoading}
          >
            {scorecardLoading ? "Loading..." : "Load Scorecard"}
          </Button>
        </div>
      </div>

      {!scorecard && !scorecardLoading && !scorecardError && (
        <div className="rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-3">
          <div className="text-sm font-semibold text-[rgb(var(--color-text))]">
            Load Scorecard to see the breakdown
          </div>
          <p className="text-xs text-[rgb(var(--color-text-subtle))]">
            Choose a year and ticker, then click Load Scorecard to view metrics,
            weights, and coverage.
          </p>
        </div>
      )}
      {scorecardError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {scorecardError}
        </div>
      )}
      {scorecardLoading && (
        <p className="text-gray-500">Loading scorecard...</p>
      )}

      {scorecard && (
        <div className="space-y-4">
          {renderScorecardSummary()}
          {renderSectionSubtotals()}
          {renderWeightsPanel()}
          {renderScorecardTable()}
          {scorecard.coverage?.missing?.length ? (
            <div className="rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3">
              <div className="text-sm font-semibold">Missing metrics</div>
              <ul className="list-disc pl-5 text-sm text-[rgb(var(--color-text))]">
                {scorecard.coverage.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card
        header={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-xs text-[rgb(var(--color-text-subtle))]">
              <span>Normalization: within-year across all tickers</span>
              <span
                className="h-3 w-px bg-[rgb(var(--color-border))]"
                aria-hidden
              />
              <span>Tie-breaker: Total Score → Coverage → Ticker</span>
            </div>
          </div>
        }
      >
        {renderTabs()}
        <div className="pt-4">
          {tab === "ranking" ? renderRankingTab() : renderScorecardTab()}
        </div>
      </Card>
    </div>
  );
};

export default Scoring;
