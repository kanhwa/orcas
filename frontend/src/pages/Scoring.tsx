import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Table } from "../components/ui/Table";
import InfoTip from "../components/InfoTip";
import { Modal } from "../components/ui/Modal";

type MissingPolicy = "redistribute" | "zero" | "drop";
type Tab = "ranking" | "scorecard";
type WeightProfile = "default" | "template" | "custom";

type WeightTemplate = {
  id: number;
  name: string;
  description?: string | null;
  mode: "metric" | "section";
  weights: Record<string, number>;
};

type WeightTemplateListResponse = {
  total: number;
  templates: WeightTemplate[];
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

async function wsmScorecard(
  payload: ScorecardRequest
): Promise<ScorecardResponse> {
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

type SectionKey = ScorecardMetric["section"];

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
  metrics?: MetricWeightInput[] | null;
  tickers?: string[] | null;
  limit?: number | null;
  missing_policy?: MissingPolicy;
  template_id?: number | null;
  weight_template_id?: number | null;
  weight_scope?: "metric" | "section" | null;
  weights_json?: Record<string, number> | null;
};

type ScorecardCoverage = {
  used: number;
  total: number;
  pct: number;
  missing: string[];
};

type ScorecardRequest = {
  year: number;
  ticker: string;
  missing_policy: MissingPolicy;
  weight_template_id?: number | null;
  weight_scope?: "metric" | "section" | null;
  weights_json?: Record<string, number> | null;
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
  default_weight?: number;
  effective_weight?: number;
  weight?: number;
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

function parseWeightInput(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return Number.NaN;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isWeightOutOfRange(weight: number): boolean {
  return !Number.isFinite(weight) || weight < 0 || weight > 100;
}

function displayWeightValue(weight: number | undefined): string | number {
  if (typeof weight === "number" && Number.isFinite(weight)) return weight;
  return "";
}

function formatDecimal(value: number | null | undefined, digits = 6): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function asPercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value <= 1) return value * 100;
  return value;
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
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [ranking, setRanking] = useState<WSMRankingPreviewItem[]>([]);
  const [rankingError, setRankingError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [weightProfile, setWeightProfile] = useState<WeightProfile>("default");
  const [weightTemplates, setWeightTemplates] = useState<WeightTemplate[]>([]);
  const [weightTemplatesError, setWeightTemplatesError] = useState("");
  const [weightTemplatesLoading, setWeightTemplatesLoading] = useState(false);
  const [selectedWeightTemplateId, setSelectedWeightTemplateId] = useState<
    number | ""
  >("");

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
  const [customScope, setCustomScope] = useState<"metric" | "section">(
    "section"
  );
  const [customSectionWeights, setCustomSectionWeights] = useState<
    Record<SectionKey, number>
  >({
    balance: Number.NaN,
    income: Number.NaN,
    cash_flow: Number.NaN,
  });
  const [customMetricWeights, setCustomMetricWeights] = useState<
    Record<string, number>
  >({});
  const [customMetricSearch, setCustomMetricSearch] = useState<string>("");
  const [customSectionFilter, setCustomSectionFilter] = useState<
    "all" | SectionKey
  >("all");
  const [lastScorecardProfile, setLastScorecardProfile] =
    useState<WeightProfile | null>(null);
  const [lastCustomWeightsPayload, setLastCustomWeightsPayload] = useState<{
    mode: "metric" | "section";
    weights: Record<string, number>;
  } | null>(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSaveError, setTemplateSaveError] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState("");
  const [startFromOfficial, setStartFromOfficial] = useState(false);

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
        setSections(catalog.sections || []);
      } catch (err) {
        const e = err as { detail?: string };
        setRankingError(e.detail || "Failed to load metrics catalog");
      } finally {
        setLoadingMeta(false);
      }
    };
    loadMetrics();
  }, []);

  const fetchWeightTemplates = useCallback(async () => {
    setWeightTemplatesLoading(true);
    setWeightTemplatesError("");
    try {
      const res = await request<WeightTemplateListResponse>(
        "/api/weight-templates?skip=0&limit=50",
        { method: "GET" }
      );
      setWeightTemplates(res.templates || []);
    } catch (err) {
      const e = err as { detail?: string };
      setWeightTemplatesError(
        e.detail ||
          "Failed to load weight templates. Default weights available."
      );
    } finally {
      setWeightTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeightTemplates();
  }, [fetchWeightTemplates]);

  const selectedWeightTemplate = useMemo(() => {
    if (!selectedWeightTemplateId) return undefined;
    return weightTemplates.find(
      (t) => t.id === Number(selectedWeightTemplateId)
    );
  }, [selectedWeightTemplateId, weightTemplates]);

  const templateSelectionRequired =
    weightProfile === "template" && !selectedWeightTemplate;

  const customWeightsInvalid = useMemo(() => {
    if (weightProfile !== "custom") return false;
    const weights =
      customScope === "section"
        ? Object.values(customSectionWeights)
        : Object.values(customMetricWeights);
    if (!weights.length) return true;
    let total = 0;
    for (const w of weights) {
      if (isWeightOutOfRange(w)) return true;
      total += Number.isFinite(w) ? w : 0;
    }
    return total <= 0;
  }, [customMetricWeights, customScope, customSectionWeights, weightProfile]);

  const weightProfileBlocked =
    templateSelectionRequired || customWeightsInvalid;

  const canSaveTemplate = useMemo(
    () =>
      !!(
        scorecard &&
        lastScorecardProfile === "custom" &&
        lastCustomWeightsPayload &&
        !customWeightsInvalid
      ),
    [
      customWeightsInvalid,
      lastCustomWeightsPayload,
      lastScorecardProfile,
      scorecard,
    ]
  );

  const metricSectionMap = useMemo(() => {
    const map = new Map<string, SectionKey>();
    sections.forEach((section) => {
      const key = section.key as SectionKey;
      section.metrics.forEach((m) => map.set(m.key, key));
    });
    scorecard?.metrics.forEach((m) => {
      map.set(m.metric_name, m.section);
    });
    return map;
  }, [scorecard, sections]);

  const deriveMetricWeights = useCallback((): Record<string, number> => {
    if (scorecard) {
      const weights: Record<string, number> = {};
      scorecard.metrics.forEach((m) => {
        weights[m.metric_name] =
          m.effective_weight ?? m.weight ?? m.default_weight ?? 0;
      });
      return weights;
    }
    const weights: Record<string, number> = {};
    metrics.forEach((m) => {
      weights[m.metric_name] = m.weight;
    });
    return weights;
  }, [metrics, scorecard]);

  const deriveSectionWeights = useCallback(
    (metricWeights: Record<string, number>): Record<SectionKey, number> => {
      const totals: Record<SectionKey, number> = {
        balance: 0,
        income: 0,
        cash_flow: 0,
      };
      Object.entries(metricWeights).forEach(([metricName, weight]) => {
        const section = metricSectionMap.get(metricName);
        if (!section) return;
        const safeWeight = Number.isFinite(weight) ? weight : 0;
        totals[section] = (totals[section] || 0) + safeWeight;
      });
      return totals;
    },
    [metricSectionMap]
  );

  const clearCustomWeights = useCallback(() => {
    setCustomSectionWeights({
      balance: Number.NaN,
      income: Number.NaN,
      cash_flow: Number.NaN,
    });
    setCustomMetricWeights({});
  }, []);

  const applyOfficialWeights = useCallback(() => {
    const metricWeights = deriveMetricWeights();
    const sectionWeights = deriveSectionWeights(metricWeights);
    setCustomMetricWeights(metricWeights);
    setCustomSectionWeights(sectionWeights);
  }, [deriveMetricWeights, deriveSectionWeights]);

  const customWeightsTotal = useMemo(() => {
    if (weightProfile !== "custom") return 0;
    const weights =
      customScope === "section"
        ? Object.values(customSectionWeights)
        : Object.values(customMetricWeights);
    return weights.reduce(
      (acc, cur) => acc + (Number.isFinite(cur) ? Number(cur) : 0),
      0
    );
  }, [customMetricWeights, customScope, customSectionWeights, weightProfile]);

  const invalidSectionWeights = useMemo(
    () => ({
      balance: isWeightOutOfRange(customSectionWeights.balance),
      income: isWeightOutOfRange(customSectionWeights.income),
      cash_flow: isWeightOutOfRange(customSectionWeights.cash_flow),
    }),
    [customSectionWeights]
  );

  const effectiveSectionPercents = useMemo(() => {
    if (weightProfile !== "custom") return null;
    const total = customWeightsTotal;
    const baseSections =
      customScope === "section"
        ? customSectionWeights
        : deriveSectionWeights(customMetricWeights);
    const entries: Record<SectionKey, number> = {
      balance: baseSections.balance || 0,
      income: baseSections.income || 0,
      cash_flow: baseSections.cash_flow || 0,
    };
    const percents: Record<SectionKey, number> = {
      balance: 0,
      income: 0,
      cash_flow: 0,
    };
    if (total <= 0) return percents;
    (Object.keys(entries) as SectionKey[]).forEach((key) => {
      percents[key] = (entries[key] / total) * 100;
    });
    return percents;
  }, [
    customScope,
    customSectionWeights,
    customWeightsTotal,
    deriveSectionWeights,
    customMetricWeights,
    weightProfile,
  ]);

  const customMetricRows = useMemo(() => {
    if (scorecard?.metrics?.length) {
      return scorecard.metrics.map((m) => ({
        metric_name: m.metric_name,
        label: m.metric_name,
        section: m.section,
      }));
    }
    const rows: { metric_name: string; label: string; section: SectionKey }[] =
      [];
    sections.forEach((section) => {
      const sectionKey = section.key as SectionKey;
      section.metrics.forEach((m) => {
        rows.push({
          metric_name: m.key,
          label: m.label || m.key,
          section: sectionKey,
        });
      });
    });
    return rows;
  }, [scorecard, sections]);

  const invalidMetricWeights = useMemo(() => {
    const map = new Map<string, boolean>();
    customMetricRows.forEach((row) => {
      const val = customMetricWeights[row.metric_name];
      const resolved = Number.isFinite(val)
        ? Number(val)
        : val === undefined
        ? 0
        : val;
      map.set(row.metric_name, isWeightOutOfRange(resolved as number));
    });
    return map;
  }, [customMetricRows, customMetricWeights]);

  const buildWeightPayload = useCallback(() => {
    if (weightProfile === "template" && selectedWeightTemplate) {
      return {
        weight_template_id: selectedWeightTemplate.id,
        weight_scope: selectedWeightTemplate.mode,
      } as Pick<WSMScoreRequest, "weight_template_id" | "weight_scope">;
    }
    if (weightProfile === "custom") {
      const weights_json =
        customScope === "section" ? customSectionWeights : customMetricWeights;
      return {
        weight_scope: customScope,
        weights_json,
      } as Pick<WSMScoreRequest, "weight_scope" | "weights_json">;
    }
    return {} as Pick<
      WSMScoreRequest,
      "weight_template_id" | "weight_scope" | "weights_json"
    >;
  }, [
    customMetricWeights,
    customScope,
    customSectionWeights,
    selectedWeightTemplate,
    weightProfile,
  ]);

  const ensureDropEligibleTickers = useCallback(
    async (year: number): Promise<string[]> => {
      if (dropEligibleByYear[year]) return dropEligibleByYear[year];
      if (!metrics.length) return [];
      if (weightProfileBlocked) return [];
      setDropEligibilityLoadingYear(year);
      try {
        const weightPayload = buildWeightPayload();
        const result = await wsmScorePreview({
          year,
          metrics,
          missing_policy: "drop",
          ...weightPayload,
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
    [buildWeightPayload, dropEligibleByYear, metrics, weightProfileBlocked]
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
  }, [
    ensureDropEligibleTickers,
    missingPolicy,
    selectedTicker,
    selectedYear,
    metrics.length,
  ]);

  const canRun = useMemo(
    () =>
      !!selectedYear &&
      metrics.length > 0 &&
      !loadingMeta &&
      !weightProfileBlocked,
    [loadingMeta, metrics.length, selectedYear, weightProfileBlocked]
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
    if (templateSelectionRequired) {
      setRankingError("Select a weight template first.");
      return;
    }
    if (customWeightsInvalid) {
      setRankingError(
        "Enter custom weights between 0 and 100 with total greater than 0."
      );
      return;
    }
    setSaveMessage("");
    setRankingError("");
    setLoading(true);
    setRanking([]);
    setRankingPolicyUsed(missingPolicy);
    try {
      const weightPayload = buildWeightPayload();
      const result = await wsmScorePreview({
        year: Number(selectedYear),
        metrics,
        missing_policy: missingPolicy,
        ...weightPayload,
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
    if (templateSelectionRequired) {
      setRankingError("Select a weight template first.");
      return;
    }
    if (customWeightsInvalid) {
      setRankingError(
        "Enter custom weights between 0 and 100 with total greater than 0."
      );
      return;
    }
    setSaveMessage("");
    setSaving(true);
    try {
      const weightPayload = buildWeightPayload();
      await wsmScore({
        year: Number(selectedYear),
        metrics,
        missing_policy: rankingPolicyUsed,
        ...weightPayload,
      });
      setSaveMessage("Saved to reports.");
    } catch (err) {
      const e = err as { detail?: string };
      setRankingError(e.detail || "Failed to save scoring run");
    } finally {
      setSaving(false);
    }
  };

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
    if (templateSelectionRequired) {
      setScorecardError("Select a weight template first.");
      return;
    }
    if (customWeightsInvalid) {
      setScorecardError(
        "Enter custom weights between 0 and 100 with total greater than zero."
      );
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
      const weightPayload = buildWeightPayload();
      const result = await wsmScorecard({
        year: resolvedYear,
        ticker,
        missing_policy: policy,
        ...weightPayload,
      });
      setLastScorecardProfile(weightProfile);
      if (weightProfile === "custom") {
        const weights_json =
          customScope === "section"
            ? customSectionWeights
            : customMetricWeights;
        setLastCustomWeightsPayload({
          mode: customScope,
          weights: { ...weights_json },
        });
      } else {
        setLastCustomWeightsPayload(null);
      }
      setTemplateSaveSuccess("");
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

  const openSaveTemplateModal = () => {
    setTemplateName("");
    setTemplateDescription("");
    setTemplateSaveError("");
    setTemplateSaveSuccess("");
    setShowSaveTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!lastCustomWeightsPayload) {
      setTemplateSaveError("No custom weights to save.");
      return;
    }
    if (!templateName.trim()) {
      setTemplateSaveError("Template name is required.");
      return;
    }
    setTemplateSaving(true);
    setTemplateSaveError("");
    try {
      const created = await request<WeightTemplate>("/api/weight-templates", {
        method: "POST",
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          mode: lastCustomWeightsPayload.mode,
          weights: lastCustomWeightsPayload.weights,
        }),
      });
      setTemplateSaving(false);
      setShowSaveTemplateModal(false);
      setTemplateSaveSuccess("Template saved.");
      setWeightProfile("template");
      setSelectedWeightTemplateId(created.id);
      fetchWeightTemplates();
    } catch (err) {
      const e = err as { detail?: string };
      setTemplateSaving(false);
      if (e.detail && `${e.detail}`.toLowerCase().includes("exists")) {
        setTemplateSaveError("Name already exists.");
      } else if (e.detail) {
        setTemplateSaveError(e.detail);
      } else {
        setTemplateSaveError("Failed to save template.");
      }
    }
  };

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

  const renderWeightProfileSelector = () => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[rgb(var(--color-text-subtle))]">
        Weight Profile
      </span>
      <Select
        value={weightProfile}
        onChange={(e) => {
          const next = e.target.value as WeightProfile;
          setWeightProfile(next);
          if (next !== "template") {
            setSelectedWeightTemplateId("");
          }
          if (next === "custom") {
            setStartFromOfficial(false);
            clearCustomWeights();
          }
        }}
        className="w-44"
      >
        <option value="default">Default</option>
        <option value="template">Template</option>
        <option value="custom">Custom</option>
      </Select>
      {weightProfile === "template" && (
        <div className="space-y-1">
          <Select
            value={selectedWeightTemplateId || ""}
            onChange={(e) =>
              setSelectedWeightTemplateId(
                e.target.value ? Number(e.target.value) : ""
              )
            }
            className="w-60"
            disabled={weightTemplatesLoading}
          >
            <option value="">Select template</option>
            {weightTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({tpl.mode})
              </option>
            ))}
          </Select>
          {weightTemplatesLoading && (
            <p className="text-[11px] text-[rgb(var(--color-text-subtle))]">
              Loading templates...
            </p>
          )}
          {weightTemplatesError && (
            <p className="text-[11px] text-red-600">{weightTemplatesError}</p>
          )}
          {!weightTemplatesLoading &&
            !weightTemplatesError &&
            !weightTemplates.length && (
              <p className="text-[11px] text-[rgb(var(--color-text-subtle))]">
                No templates available. Default weights will be used.
              </p>
            )}
          {templateSelectionRequired && (
            <p className="text-[11px] text-red-600">
              Choose a template before running.
            </p>
          )}
        </div>
      )}
    </div>
  );

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
          {renderWeightProfileSelector()}
          <Button onClick={handleRun} disabled={!canRun || loading}>
            {loading ? "Running..." : "Run Scoring"}
          </Button>
        </div>
        <p className="text-xs text-[rgb(var(--color-text-subtle))]">
          Scoring uses the selected weight profile; missing metrics follow the
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
                disabled={saving || weightProfileBlocked}
                variant="secondary"
              >
                {saving ? "Saving..." : "Save to report"}
              </Button>
              {saveMessage && (
                <span className="text-xs text-green-700">{saveMessage}</span>
              )}
            </div>
            <p className="text-xs text-[rgb(var(--color-text-subtle))]">
              Preview uses the selected weight profile; save to persist in
              Reports.
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

  const renderCustomWeightsPanel = () => {
    const totalLabel = formatDecimal(customWeightsTotal, 6);
    const showError = weightProfile === "custom" && customWeightsInvalid;
    const totalIsZero = weightProfile === "custom" && customWeightsTotal <= 0;
    const showSectionErrors =
      customScope === "section" &&
      (invalidSectionWeights.balance ||
        invalidSectionWeights.income ||
        invalidSectionWeights.cash_flow);
    const showMetricErrors =
      customScope === "metric" &&
      Array.from(invalidMetricWeights.values()).some(Boolean);
    const canShowEffectivePercents =
      weightProfile === "custom" && customWeightsTotal > 0 && !showError;

    const renderSectionInputs = () => (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(
          [
            { key: "balance", label: "Balance" },
            { key: "income", label: "Income" },
            { key: "cash_flow", label: "Cash Flow" },
          ] as { key: SectionKey; label: string }[]
        ).map((entry) => (
          <label
            key={entry.key}
            className="flex flex-col gap-1 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3"
          >
            <span className="text-sm font-medium text-[rgb(var(--color-text))]">
              {entry.label}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={displayWeightValue(customSectionWeights[entry.key])}
              onChange={(e) =>
                setCustomSectionWeights((prev) => ({
                  ...prev,
                  [entry.key]: parseWeightInput(e.target.value),
                }))
              }
              className={`w-full rounded border px-2 py-1 text-sm ${
                invalidSectionWeights[entry.key]
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : "border-[rgb(var(--color-border))]"
              }`}
            />
            {invalidSectionWeights[entry.key] && (
              <span className="text-[11px] text-red-600">Enter 0–100</span>
            )}
          </label>
        ))}
      </div>
    );

    const filteredMetricRows = customMetricRows.filter((row) => {
      const matchesSection =
        customSectionFilter === "all" || row.section === customSectionFilter;
      const term = customMetricSearch.trim().toLowerCase();
      const matchesSearch = term
        ? row.metric_name.toLowerCase().includes(term) ||
          row.label.toLowerCase().includes(term)
        : true;
      return matchesSection && matchesSearch;
    });

    const renderMetricInputs = () => (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search metric"
            value={customMetricSearch}
            onChange={(e) => setCustomMetricSearch(e.target.value)}
            className="w-52 rounded border border-[rgb(var(--color-border))] px-2 py-1 text-sm"
          />
          <Select
            value={customSectionFilter}
            onChange={(e) =>
              setCustomSectionFilter(e.target.value as "all" | SectionKey)
            }
            className="w-44"
          >
            <option value="all">All sections</option>
            <option value="balance">Balance</option>
            <option value="income">Income</option>
            <option value="cash_flow">Cash Flow</option>
          </Select>
        </div>
        <div className="max-h-96 overflow-auto rounded border border-[rgb(var(--color-border))]">
          <Table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Section</th>
                <th className="w-40">Weight</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetricRows.map((row) => (
                <tr key={`custom-weight-${row.metric_name}`}>
                  <td>{row.label}</td>
                  <td>{SECTION_LABELS[row.section]}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={displayWeightValue(
                        customMetricWeights[row.metric_name]
                      )}
                      onChange={(e) =>
                        setCustomMetricWeights((prev) => ({
                          ...prev,
                          [row.metric_name]: parseWeightInput(e.target.value),
                        }))
                      }
                      className={`w-full rounded border px-2 py-1 text-sm ${
                        invalidMetricWeights.get(row.metric_name)
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-[rgb(var(--color-border))]"
                      }`}
                    />
                    {invalidMetricWeights.get(row.metric_name) && (
                      <span className="text-[11px] text-red-600">
                        Enter 0–100
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    );

    return (
      <div className="space-y-3 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[rgb(var(--color-text))]">
              Custom weights
            </span>
            <InfoTip content="Section: edit Balance/Income/Cash Flow. Metric: edit individual metrics." />
          </div>
          <Select
            value={customScope}
            onChange={(e) =>
              setCustomScope(e.target.value as "metric" | "section")
            }
            className="w-36"
          >
            <option value="section">Section</option>
            <option value="metric">Metric</option>
          </Select>
          <div className="flex items-center gap-1 text-xs text-[rgb(var(--color-text-subtle))]">
            <span className="font-medium text-[rgb(var(--color-text))]">
              Total weight: {totalLabel}
            </span>
            <InfoTip content="Total is the sum of raw inputs (0–100). Must be > 0 to run." />
          </div>
          <label className="ml-auto flex items-center gap-2 text-xs text-[rgb(var(--color-text))]">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={startFromOfficial}
              onChange={(e) => {
                const checked = e.target.checked;
                setStartFromOfficial(checked);
                if (checked) {
                  applyOfficialWeights();
                } else {
                  clearCustomWeights();
                }
              }}
            />
            <span>Start from official weights</span>
            <InfoTip content="Prefill using default weights. Turn off to clear back to empty." />
          </label>
        </div>
        <p className="text-xs text-[rgb(var(--color-text-subtle))]">
          Enter weights 0–100. Use 0 to exclude. Weights normalize
          automatically; see effective preview below when valid.
        </p>
        {canShowEffectivePercents && effectiveSectionPercents && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[rgb(var(--color-text-subtle))]">
              Effective weight preview:
            </span>
            {(["balance", "income", "cash_flow"] as SectionKey[]).map((key) => (
              <span key={key} className="text-[rgb(var(--color-text))]">
                {SECTION_LABELS[key]}{" "}
                {formatDecimal(effectiveSectionPercents[key], 1)}%
              </span>
            ))}
          </div>
        )}
        {(showError || totalIsZero) && (
          <span className="text-xs text-red-600">
            Total must be greater than 0 and all weights must be between 0 and
            100.
          </span>
        )}
        {showSectionErrors && (
          <span className="text-xs text-red-600">
            Fix highlighted section weights.
          </span>
        )}
        {showMetricErrors && (
          <span className="text-xs text-red-600">
            Fix highlighted metric weights.
          </span>
        )}
        {customScope === "section"
          ? renderSectionInputs()
          : renderMetricInputs()}
      </div>
    );
  };

  const renderWeightsPanel = () => {
    if (!scorecard || !scorecard.metrics.length) return null;
    const isTemplateProfile = weightProfile === "template";
    const isCustomProfile = weightProfile === "custom";
    return (
      <div className="space-y-2 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3">
        <div className="flex flex-wrap items-center gap-3">
          {isCustomProfile ? (
            <p className="text-xs text-[rgb(var(--color-text-subtle))]">
              Custom weights accept values 0–100 and will be normalized
              automatically for this scorecard run.
            </p>
          ) : isTemplateProfile ? (
            <p className="text-xs text-[rgb(var(--color-text-subtle))]">
              Template weights are applied.
            </p>
          ) : (
            <p className="text-xs text-[rgb(var(--color-text-subtle))]">
              Default weights are applied.
            </p>
          )}
        </div>
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
            <th>Weight</th>
            <th>Contribution</th>
            <th>Unit</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            return (
              <tr key={`${m.metric_name}-${m.section}`}>
                <td>{m.metric_name}</td>
                <td>{SECTION_LABELS[m.section]}</td>
                <td className="capitalize">{m.type}</td>
                <td>
                  {m.raw_value === null ? "—" : formatDecimal(m.raw_value, 4)}
                </td>
                <td>{formatDecimal(m.normalized_value)}</td>
                <td>
                  {formatDecimal(
                    m.effective_weight ?? m.weight ?? m.default_weight ?? 0
                  )}
                </td>
                <td>{formatDecimal(m.contribution)}</td>
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
          {renderWeightProfileSelector()}
        </div>
      </div>

      {weightProfile === "custom" && renderCustomWeightsPanel()}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => handleLoadScorecard()}
          disabled={scorecardLoading || weightProfileBlocked}
        >
          {scorecardLoading ? "Loading..." : "Load Scorecard"}
        </Button>
        {templateSelectionRequired && weightProfile === "template" && (
          <span className="text-xs text-red-600">
            Select a template before loading.
          </span>
        )}
        {weightProfile === "custom" && customWeightsInvalid && (
          <span className="text-xs text-red-600">
            Enter custom weights 0–100; total must be greater than 0 to load.
          </span>
        )}
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
          {canSaveTemplate && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={openSaveTemplateModal}>
                Save as Template
              </Button>
              {templateSaveSuccess && (
                <span className="text-xs text-green-700">
                  {templateSaveSuccess}
                </span>
              )}
            </div>
          )}
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
    <>
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

      {showSaveTemplateModal && (
        <Modal
          title="Save weight template"
          open={showSaveTemplateModal}
          onClose={() => setShowSaveTemplateModal(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowSaveTemplateModal(false)}
                disabled={templateSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} disabled={templateSaving}>
                {templateSaving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[rgb(var(--color-text))]">
                Name<span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full rounded border border-[rgb(var(--color-border))] px-2 py-1 text-sm"
                placeholder="Template name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[rgb(var(--color-text))]">
                Description (optional)
              </label>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                className="min-h-[80px] w-full rounded border border-[rgb(var(--color-border))] px-2 py-1 text-sm"
                placeholder="Add notes for yourself"
              />
            </div>
            <p className="text-xs text-[rgb(var(--color-text-subtle))]">
              Templates are private to your account.
            </p>
            {templateSaveError && (
              <p className="text-sm text-red-600">{templateSaveError}</p>
            )}
            {templateSaveSuccess && (
              <p className="text-xs text-green-700">{templateSaveSuccess}</p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default Scoring;
