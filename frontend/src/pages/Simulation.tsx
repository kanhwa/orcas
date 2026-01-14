import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useCatalog } from "../contexts/CatalogContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import {
  getEmitens,
  EmitenItem,
  simulate,
  getYears,
  getMetricsCatalog,
  SimulationAdjustmentDetail,
  listWeightTemplates,
  WeightTemplate,
  createReport,
} from "../services/api";
import InfoTip from "../components/InfoTip";
import { buildReportPdfBase64Async } from "../utils/reportPdf";
import { toErrorMessage } from "../utils/errors";

// Scoring metric option for dropdown (flattened from catalog)
interface ScoringMetricOption {
  key: string;
  label: string;
  section: string;
  sectionLabel: string;
  type?: "benefit" | "cost" | null;
  default_weight?: number | null;
}

// Normalize metric name for dedup (existing behavior)
function normalizeMetricName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[(),]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalization for unit lookup (preserves punctuation, removes zero-width)
function normalizeMetricKey(value: string | null | undefined): string {
  if (value === undefined || value === null) return "";
  const base = normalizeMetricName(String(value));
  return base.replace(/[_-]+/g, " ");
}

type UnitResolution = {
  cfg: { displayUnit: string; inputMode: string } | null;
  lookupKey: string | null;
  normalizedKey: string | null;
  candidates: string[];
};

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
  adjustments_detail: SimulationAdjustmentDetail[];
  warnings: string[];
}

type WeightProfile = "default" | "template";

type AppliedAdjustmentRow = SimulationAdjustmentDetail & {
  display_label?: string | null;
  unitResolution?: UnitResolution;
  displayUnit?: string | null;
  baselineDisplay?: string;
  simulatedDisplay?: string;
};

const Simulation: React.FC = () => {
  const { catalog, getYearOptions } = useCatalog();
  const DEBUG_UNITS = useMemo(
    () => new URLSearchParams(window.location.search).has("debugUnits"),
    []
  );
  const DEBUG_SIM = useMemo(
    () => new URLSearchParams(window.location.search).has("debugSim"),
    []
  );

  // Emiten dropdown data
  const [emitens, setEmitens] = useState<EmitenItem[]>([]);
  const [loadingEmitens, setLoadingEmitens] = useState(true);

  // Years
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [baselineYear, setBaselineYear] = useState<number | null>(null);
  const [loadingYears, setLoadingYears] = useState(true);

  // Unit mapping (loaded from public/metric_unit_mapping.csv)
  const [metricUnitMap, setMetricUnitMap] = useState<
    Record<string, { displayUnit: string; inputMode: string }>
  >({});
  const [metricUnitMapNormalized, setMetricUnitMapNormalized] = useState<
    Record<string, { displayUnit: string; inputMode: string }>
  >({});

  // Overall scoring metrics (from metrics-catalog endpoint, flattened)
  const [scoringMetrics, setScoringMetrics] = useState<ScoringMetricOption[]>(
    []
  );
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Weight profile / templates
  const [weightProfile, setWeightProfile] = useState<WeightProfile>("default");
  const [weightTemplates, setWeightTemplates] = useState<WeightTemplate[]>([]);
  const [weightTemplatesLoading, setWeightTemplatesLoading] = useState(false);
  const [weightTemplatesError, setWeightTemplatesError] = useState("");
  const [selectedWeightTemplateId, setSelectedWeightTemplateId] = useState<
    number | ""
  >("");
  const selectedWeightTemplate = useMemo(() => {
    if (!selectedWeightTemplateId) return undefined;
    return weightTemplates.find(
      (t) => t.id === Number(selectedWeightTemplateId)
    );
  }, [selectedWeightTemplateId, weightTemplates]);

  // Form state
  const [selectedTicker, setSelectedTicker] = useState("");
  const [adjustments, setAdjustments] = useState<MetricAdjustment[]>([]);
  const [nextId, setNextId] = useState(1);

  // Results
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultWeightLabel, setResultWeightLabel] = useState<string>("");

  // Save to Reports
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingReport, setSavingReport] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Lookup detail rows by metric key/name for applied adjustments
  const detailLookup = useMemo(() => {
    const map = new Map<string, SimulationAdjustmentDetail>();
    const details = result?.adjustments_detail || [];
    for (const d of details) {
      const key = d.metric_key || d.metric_name;
      if (key) {
        map.set(normalizeMetricName(key), d);
      }
      // also store normalized metric_name for robustness
      map.set(normalizeMetricName(d.metric_name), d);
    }
    return map;
  }, [result?.adjustments_detail]);

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
        const years = res.years || [];
        setAvailableYears(years);
        if (years.length > 0) {
          const latest = Math.max(...years);
          setBaselineYear(latest);
        }
      } catch (err) {
        console.error("Failed to load years:", err);
        // Fallback: use hardcoded years
        const years = getYearOptions();
        setAvailableYears(years);
        if (years.length > 0) {
          const latest = Math.max(...years);
          setBaselineYear(latest);
        }
      } finally {
        setLoadingYears(false);
      }
    };

    const parseCsv = (text: string): string[][] => {
      const rows: string[][] = [];
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        if (!line.trim()) continue;
        const row: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
            continue;
          }
          if (ch === "," && !inQuotes) {
            row.push(current.trim());
            current = "";
            continue;
          }
          current += ch;
        }
        row.push(current.trim());
        rows.push(row);
      }

      return rows;
    };

    const loadMetricUnitMapping = async () => {
      try {
        // Use absolute path so it works regardless of current route
        const url = `/metric_unit_mapping.csv`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch unit mapping: ${res.status}`);
        }
        const text = await res.text();
        const rows = parseCsv(text);
        if (rows.length === 0) return;

        const header = rows[0].map((h) => h.trim().toLowerCase());
        const metricIdx = header.indexOf("metric_name");
        const unitIdx = header.indexOf("display_unit");
        const modeIdx = header.indexOf("input_mode");
        if (metricIdx === -1 || unitIdx === -1 || modeIdx === -1) {
          console.warn(
            "metric_unit_mapping.csv missing required headers: metric_name, display_unit, input_mode"
          );
          return;
        }

        const map: Record<string, { displayUnit: string; inputMode: string }> =
          {};
        const normalizedMap: Record<
          string,
          { displayUnit: string; inputMode: string }
        > = {};
        for (const row of rows.slice(1)) {
          const metricName = (row[metricIdx] || "").trim();
          if (!metricName) continue;
          const displayUnit = (row[unitIdx] || "").trim();
          const inputMode = (row[modeIdx] || "").trim();
          const cfg = { displayUnit, inputMode };
          map[metricName] = cfg;
          const normalizedKey = normalizeMetricKey(metricName);
          if (normalizedKey) {
            normalizedMap[normalizedKey] = cfg;
          }
        }
        setMetricUnitMap(map);
        setMetricUnitMapNormalized(normalizedMap);

        if (DEBUG_UNITS) {
          const sampleKeys = Object.keys(map).slice(0, 20);
          console.log(
            "[Simulation][debugUnits] unitMap sample keys",
            sampleKeys
          );
        }
      } catch (err) {
        console.error("Failed to load metric_unit_mapping.csv:", err);
      }
    };

    const loadScoringMetrics = async () => {
      try {
        // Use metrics-catalog endpoint (returns 39 metrics across 3 sections)
        const catalog = await getMetricsCatalog();
        const metrics: ScoringMetricOption[] = [];
        const seenNormalized = new Set<string>();

        for (const section of catalog.sections || []) {
          const sectionKey = section.key || "";
          const sectionLabel = section.label || sectionKey;
          for (const metric of section.metrics || []) {
            const metricName = metric.key || metric.label || "";
            if (!metricName) continue;

            // Dedup by normalized name
            const normalizedKey = normalizeMetricName(metricName);
            if (seenNormalized.has(normalizedKey)) {
              continue;
            }
            seenNormalized.add(normalizedKey);

            metrics.push({
              key: metricName,
              label: metric.label || metricName,
              section: sectionKey,
              sectionLabel: sectionLabel,
              type: metric.type || null,
              default_weight:
                metric.default_weight !== undefined
                  ? metric.default_weight
                  : null,
            });
          }
        }

        // Log count for verification
        console.log(
          `[Simulation] Loaded ${metrics.length} scoring metrics (expected: 39)`
        );
        setScoringMetrics(metrics);
      } catch (err) {
        console.error("Failed to load scoring metrics:", err);
        setScoringMetrics([]);
      } finally {
        setLoadingMetrics(false);
      }
    };

    loadEmitens();
    loadYears();
    loadScoringMetrics();
    loadMetricUnitMapping();
  }, []);

  const fetchWeightTemplates = useCallback(async () => {
    setWeightTemplatesLoading(true);
    setWeightTemplatesError("");
    try {
      const res = await listWeightTemplates(0, 50);
      setWeightTemplates(res.templates || []);
    } catch (err) {
      setWeightTemplatesError(
        `${toErrorMessage(err)}. Default weights will be used.`
      );
    } finally {
      setWeightTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeightTemplates();
  }, [fetchWeightTemplates]);

  const sectionLabelByKey = useMemo(() => {
    const map: Record<string, string> = {
      income: "Income",
      balance: "Balance",
      cashflow: "Cashflow",
    };
    if (catalog?.sections) {
      for (const s of catalog.sections) {
        map[s.key] = s.label;
      }
    }
    return map;
  }, [catalog]);

  // scoringMetrics is already in the correct ScoringMetricOption format
  const scoringMetricOptions = scoringMetrics;

  // Group metrics by section for dropdown (like Screening/Analysis)
  const metricsBySection = useMemo(() => {
    const groups: Record<string, ScoringMetricOption[]> = {};
    for (const m of scoringMetricOptions) {
      const sectionKey = m.section || "other";
      if (!groups[sectionKey]) groups[sectionKey] = [];
      groups[sectionKey].push(m);
    }
    return groups;
  }, [scoringMetricOptions]);

  const scenarioYear = useMemo(() => {
    if (!baselineYear) return null;
    return baselineYear + 1;
  }, [baselineYear]);

  // Get already selected metric keys (to prevent duplicates)
  const selectedMetricKeys = useMemo(() => {
    return new Set(
      adjustments.filter((a) => a.metric_name).map((a) => a.metric_name)
    );
  }, [adjustments]);

  // Available metrics grouped by section (excluding already selected)
  const availableMetricsBySection = useMemo(() => {
    const groups: Record<string, ScoringMetricOption[]> = {};
    for (const [section, metrics] of Object.entries(metricsBySection)) {
      const filtered = metrics.filter((m) => !selectedMetricKeys.has(m.key));
      if (filtered.length > 0) {
        groups[section] = filtered;
      }
    }
    return groups;
  }, [metricsBySection, selectedMetricKeys]);

  const templateSelectionRequired =
    weightProfile === "template" && !selectedWeightTemplateId;

  const canRunSimulation =
    !!selectedTicker &&
    (weightProfile === "default" ||
      (weightProfile === "template" && !!selectedWeightTemplateId));

  // Check if any metrics are available
  const hasAvailableMetrics = useMemo(() => {
    return Object.values(availableMetricsBySection).some(
      (arr) => arr.length > 0
    );
  }, [availableMetricsBySection]);

  // Add Metric button is disabled if no ticker selected or no metrics available
  const canAddMetric = selectedTicker && hasAvailableMetrics && !loadingMetrics;

  // Add new metric adjustment row (only if ticker selected and metrics available)
  const addAdjustment = () => {
    if (!canAddMetric) return;

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
          const metric = scoringMetricOptions.find((m) => m.key === value);
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

    if (templateSelectionRequired) {
      setError("Select a weight template to run simulation.");
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
    setSaveMessage("");

    try {
      // Build overrides - backend expects value as the percentage adjustment
      const overrides = validAdjustments.map((a) => ({
        metric_name: a.metric_name,
        value: a.adjustment_percent, // Percentage adjustment
      }));

      const weightPayload =
        weightProfile === "template" && selectedWeightTemplateId
          ? { weight_template_id: selectedWeightTemplateId }
          : {};

      const response = await simulate({
        ticker: selectedTicker,
        year: baselineYear,
        mode: "overall",
        section: null,
        overrides,
        missing_policy: "zero",
        weight_profile: weightProfile,
        ...weightPayload,
      });

      // Find emiten name and format (remove "Unknown" suffix)
      const emiten = emitens.find((e) => e.ticker_code === selectedTicker);
      let tickerName = emiten?.bank_name || selectedTicker;
      // Remove "- Unknown" or "Unknown" suffix
      if (
        tickerName &&
        (tickerName.includes("Unknown") || tickerName.endsWith("- "))
      ) {
        tickerName =
          tickerName
            .replace(/\s*-\s*Unknown$/, "")
            .replace(/^Unknown\s*-?\s*/, "")
            .trim() || selectedTicker;
      }

      const baselineScore = response.baseline_score || 0;
      const simulatedScore = response.simulated_score || 0;
      const delta = response.delta || 0;

      const weightLabel =
        weightProfile === "template" && selectedWeightTemplate
          ? `Template: ${selectedWeightTemplate.name} (${selectedWeightTemplate.mode})`
          : weightProfile === "template"
          ? "Template weights"
          : "Default weights";

      setResult({
        ticker: selectedTicker,
        ticker_name: tickerName,
        baseline_year: baselineYear,
        simulation_year: scenarioYear ? String(scenarioYear) : "N/A",
        baseline_score: baselineScore,
        simulated_score: simulatedScore,
        delta: delta,
        delta_percent: baselineScore ? (delta / baselineScore) * 100 : 0,
        adjustments_detail: response.adjustments_detail || [],
        warnings: response.message ? [response.message] : [],
      });
      setResultWeightLabel(weightLabel);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setSelectedTicker("");
    setAdjustments([]);
    setNextId(1);
    setResult(null);
    setError(null);
    setResultWeightLabel("");
    if (availableYears.length > 0) {
      const latest = Math.max(...availableYears);
      setBaselineYear(latest);
    } else {
      setBaselineYear(null);
    }
  };

  const resolveUnitConfig = useCallback(
    (candidates: (string | null | undefined)[]): UnitResolution => {
      const candidateList = candidates
        .map((c) => (c === undefined || c === null ? "" : String(c)))
        .filter((c) => c.trim().length > 0);

      for (const candidate of candidateList) {
        if (metricUnitMap[candidate]) {
          return {
            cfg: metricUnitMap[candidate],
            lookupKey: candidate,
            normalizedKey: null,
            candidates: candidateList,
          };
        }

        const normalized = normalizeMetricKey(candidate);
        if (!normalized) continue;

        if (metricUnitMap[normalized]) {
          return {
            cfg: metricUnitMap[normalized],
            lookupKey: candidate,
            normalizedKey: normalized,
            candidates: candidateList,
          };
        }

        if (metricUnitMapNormalized[normalized]) {
          return {
            cfg: metricUnitMapNormalized[normalized],
            lookupKey: candidate,
            normalizedKey: normalized,
            candidates: candidateList,
          };
        }
      }

      return {
        cfg: null,
        lookupKey: null,
        normalizedKey: null,
        candidates: candidateList,
      };
    },
    [metricUnitMap, metricUnitMapNormalized]
  );

  const formatValueForMetric = (
    metric: {
      metric_name: string;
      metric_key?: string | null;
      display_label?: string | null;
      unitResolution?: ReturnType<typeof resolveUnitConfig>;
      displayUnit?: string | null;
    },
    rawValue: number | null | undefined
  ): string => {
    if (rawValue === null || rawValue === undefined || Number.isNaN(rawValue)) {
      return "—";
    }

    const resolution =
      metric.unitResolution ||
      resolveUnitConfig([
        metric.metric_key,
        metric.display_label,
        metric.metric_name,
      ]);
    const cfg = resolution.cfg;
    const displayUnit =
      (metric as { displayUnit?: string | null }).displayUnit ??
      cfg?.displayUnit ??
      "";
    const inputMode = cfg?.inputMode;
    const formatNum = (v: number, decimals = 2) =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(v);

    let displayValue = rawValue;
    if (inputMode === "percent_points") {
      displayValue = rawValue * 100;
    }

    const unit = displayUnit.trim();
    switch (unit) {
      case "":
        return formatNum(displayValue, 2);
      case "%":
        return `${formatNum(displayValue, 2)}%`;
      case "x":
        return `${formatNum(displayValue, 2)}x`;
      case "ratio":
        return formatNum(displayValue, 4);
      default:
        return `${formatNum(displayValue, 2)} ${unit}`.trim();
    }
  };

  // Format number with sign
  const formatNumber = (value: number, decimals = 4) => {
    return value.toFixed(decimals);
  };

  const formatSigned = (value: number, decimals = 4) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatNumber(value, decimals)}`;
  };

  const openSaveModal = () => {
    if (!result) return;
    setSaveError("");
    setSaveMessage("");
    setReportName(
      `Simulation ${result.ticker} ${result.baseline_year}-${result.simulation_year}`
    );
    setSaveOpen(true);
  };

  const handleSaveReport = async () => {
    if (!result) return;
    const name = reportName.trim();
    if (!name) {
      setSaveError("Name is required");
      return;
    }

    const safeName = name
      .replace(/→/g, "-")
      .replace(/\s*-\s*/g, "-")
      .trim();
    const normalizedName = safeName || name;

    setSavingReport(true);
    setSaveError("");

    try {
      const weightTemplateId =
        weightProfile === "template" && selectedWeightTemplateId
          ? Number(selectedWeightTemplateId)
          : null;

      const weightProfileLabel =
        weightProfile === "template" && selectedWeightTemplate
          ? `Template (${selectedWeightTemplate.name})`
          : "Default";

      const metadata = {
        report_type: "simulation_scenario",
        ticker: result.ticker,
        ticker_name: result.ticker_name,
        baseline_year: result.baseline_year,
        simulation_year: result.simulation_year,
        weight_profile: weightProfile,
        weight_profile_label: weightProfileLabel,
        weight_template_id: weightTemplateId,
        weight_label: resultWeightLabel,
        baseline_score: result.baseline_score,
        simulated_score: result.simulated_score,
        delta: result.delta,
        delta_percent: result.delta_percent,
        adjustments: appliedAdjustmentRows.map((adj) => ({
          metric_name: adj.metric_name,
          section: adj.section,
          type: adj.type,
          adjustment_percent: adj.adjustment_percent,
          baseline_value: adj.baseline_value,
          simulated_value: adj.simulated_value,
          unit: adj.displayUnit || null,
        })),
      };

      const pdfMetadata = [
        { label: "View", value: "Simulation Scenario" },
        { label: "Ticker", value: result.ticker },
        { label: "Baseline Year", value: result.baseline_year },
        { label: "Simulated Year", value: result.simulation_year },
        { label: "Weight Profile", value: weightProfileLabel },
        {
          label: "Note",
          value:
            "Simulated year is a label for what-if analysis, not a forecast.",
        },
      ];

      const summaryRow = [
        formatNumber(result.baseline_score, 4),
        formatNumber(result.simulated_score, 4),
        formatSigned(result.delta, 4),
        `(${formatSigned(result.delta_percent, 2)}%)`,
      ];

      const adjustmentRows = appliedAdjustmentRows.map((adj) => {
        const sectionLabel =
          (adj.section && sectionLabelByKey[adj.section]) || adj.section || "";
        const typeLabel = adj.type
          ? adj.type.charAt(0).toUpperCase() + adj.type.slice(1)
          : "";
        return [
          adj.display_label || adj.metric_name,
          sectionLabel,
          typeLabel,
          adj.baselineDisplay ?? "—",
          adj.simulatedDisplay ?? "—",
          `${adj.adjustment_percent >= 0 ? "+" : ""}${adj.adjustment_percent}%`,
        ];
      });

      const pdf_base64 = await buildReportPdfBase64Async({
        name: normalizedName,
        type: "simulation_scenario",
        metadata: pdfMetadata,
        sections: [
          {
            title: "Simulation Summary",
            columns: [
              `Baseline Score (${result.baseline_year})`,
              `Simulated Score (${result.simulation_year})`,
              "Change",
              "Change (%)",
            ],
            rows: [summaryRow],
          },
          {
            title: "Applied Adjustments",
            columns: [
              "Metric",
              "Section",
              "Type",
              `Baseline Value (${result.baseline_year})`,
              `Simulated Value (${result.simulation_year})`,
              "Adjustment (%)",
            ],
            rows: adjustmentRows,
          },
        ],
      });

      await createReport({
        name: normalizedName,
        type: "simulation_scenario",
        pdf_base64,
        metadata,
      });
      setSaveMessage("Saved to Reports.");
      setSaveOpen(false);
    } catch (err) {
      setSaveError(toErrorMessage(err));
    } finally {
      setSavingReport(false);
    }
  };

  // Build applied adjustment rows aligned to selected overrides (one row per selection)
  const appliedAdjustmentRows: AppliedAdjustmentRow[] = useMemo(() => {
    return adjustments
      .filter((a) => a.metric_name)
      .map((a) => {
        const detail = detailLookup.get(normalizeMetricName(a.metric_name));
        const selectedMetric = scoringMetricOptions.find(
          (m) => m.key === a.metric_name
        );
        const unitResolution = resolveUnitConfig([
          detail?.metric_key,
          selectedMetric?.label,
          a.metric_name,
        ]);
        const displayUnit = unitResolution.cfg?.displayUnit ?? null;
        const row: AppliedAdjustmentRow = {
          metric_name: a.metric_name,
          metric_key: detail?.metric_key || null,
          display_label: selectedMetric?.label || a.metric_name,
          section: detail?.section || a.section || null,
          type: detail?.type ?? selectedMetric?.type ?? null,
          baseline_value: detail?.baseline_value ?? null,
          simulated_value: detail?.simulated_value ?? null,
          adjustment_percent:
            detail?.adjustment_percent ?? a.adjustment_percent,
          affects_score: detail?.affects_score ?? true,
          out_of_range: detail?.out_of_range ?? false,
          capped: detail?.capped ?? false,
          ignored: false,
          reason: detail?.reason
            ? detail.reason
            : detail?.unmatched_reason
            ? ""
            : null,
          unitResolution,
          displayUnit,
        };

        const rowWithUnit: AppliedAdjustmentRow = {
          ...row,
          baselineDisplay: formatValueForMetric(
            { ...row, displayUnit },
            row.baseline_value
          ),
          simulatedDisplay: formatValueForMetric(
            { ...row, displayUnit },
            row.simulated_value
          ),
        };

        return rowWithUnit;
      });
  }, [
    adjustments,
    detailLookup,
    resolveUnitConfig,
    formatValueForMetric,
    scoringMetricOptions,
    metricUnitMap,
    metricUnitMapNormalized,
  ]);

  useEffect(() => {
    if (!DEBUG_SIM) return;
    if (!result) return;
    console.log("[Simulation][debugSim] raw scores", {
      baseline_score: result.baseline_score,
      simulated_score: result.simulated_score,
      delta: result.delta,
      delta_percent: result.delta_percent,
    });
  }, [DEBUG_SIM, result]);

  useEffect(() => {
    if (!DEBUG_UNITS) return;
    if (!appliedAdjustmentRows.length) return;
    const rowsForLog = appliedAdjustmentRows.map((row) => ({
      metric_name: row.metric_name,
      metric_key: row.metric_key || "",
      display_label: row.display_label || "",
      lookup_key: row.unitResolution?.lookupKey || "",
      normalized_key: row.unitResolution?.normalizedKey || "",
      unit_found: row.unitResolution?.cfg?.displayUnit || null,
      candidates: row.unitResolution?.candidates.join(" | ") || "",
    }));
    console.table(rowsForLog);
  }, [DEBUG_UNITS, appliedAdjustmentRows]);

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
            <div className="flex items-center gap-3 text-sm mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-medium">Baseline Year:</span>
                <span className="font-semibold">
                  {baselineYear ?? (loadingYears ? "Loading..." : "N/A")}
                </span>
              </div>

              <span className="mx-1">→</span>

              <div className="flex items-center gap-2">
                <span className="font-medium">Simulated Year:</span>
                <span className="font-semibold">{scenarioYear ?? "N/A"}</span>
              </div>
            </div>
            <div className="text-xs text-[rgb(var(--color-text-subtle))] bg-blue-50 border border-blue-200 rounded p-2">
              ℹ️ Simulated year is a label for what-if analysis, not a forecast.
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
                  displayName = displayName
                    .replace(/\s*-\s*Unknown$/, "")
                    .replace(/^Unknown\s*-?\s*/, "")
                    .trim();
                }
                const finalName = displayName || "Unknown";
                return (
                  <option key={e.ticker_code} value={e.ticker_code}>
                    {e.ticker_code}
                    {finalName && finalName !== "Unknown"
                      ? ` - ${finalName}`
                      : ""}
                  </option>
                );
              })}
            </Select>
          </div>

          {/* Weight Profile */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[rgb(var(--color-text))] mb-2">
              Weight Profile
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={weightProfile}
                onChange={(e) => {
                  const next = e.target.value as WeightProfile;
                  setWeightProfile(next);
                  if (next === "default") {
                    setSelectedWeightTemplateId("");
                  }
                }}
                className="w-44"
              >
                <option value="default">Default</option>
                <option value="template">Template</option>
              </Select>

              {weightProfile === "template" && (
                <div className="flex flex-col gap-1">
                  <Select
                    value={selectedWeightTemplateId || ""}
                    onChange={(e) =>
                      setSelectedWeightTemplateId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    className="w-64"
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
                    <span className="text-[11px] text-[rgb(var(--color-text-subtle))]">
                      Loading templates...
                    </span>
                  )}
                  {weightTemplatesError && (
                    <span className="text-[11px] text-red-600">
                      {weightTemplatesError}
                    </span>
                  )}
                  {!weightTemplatesLoading &&
                    !weightTemplatesError &&
                    weightTemplates.length === 0 && (
                      <span className="text-[11px] text-[rgb(var(--color-text-subtle))]">
                        No templates yet.
                      </span>
                    )}
                  {templateSelectionRequired && (
                    <span className="text-[11px] text-red-600">
                      Choose a template to run simulation.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Metric Adjustments */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-[rgb(var(--color-text))]">
                Metric Adjustments
                <InfoTip content="Select metrics and set percentage adjustments. Positive values increase, negative values decrease the metric." />
              </label>
              <div className="flex items-center gap-2">
                {!selectedTicker && (
                  <span className="text-xs text-[rgb(var(--color-text-subtle))]">
                    Select an emiten first
                  </span>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addAdjustment}
                  disabled={!canAddMetric}
                >
                  + Add Metric
                </Button>
              </div>
            </div>

            {adjustments.length === 0 ? (
              <div className="text-center py-8 bg-[rgb(var(--color-surface))] rounded-lg border-2 border-dashed border-[rgb(var(--color-border))]">
                <p className="text-[rgb(var(--color-text-subtle))]">
                  {selectedTicker
                    ? 'No metrics added yet. Click "Add Metric" to start.'
                    : "Select an emiten above, then add metrics."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {adjustments.map((adj) => {
                  // Build row-specific grouped options
                  const rowGroupedOptions: Record<
                    string,
                    ScoringMetricOption[]
                  > = {};
                  for (const [section, metrics] of Object.entries(
                    metricsBySection
                  )) {
                    const filtered = metrics.filter(
                      (m) =>
                        m.key === adj.metric_name ||
                        !selectedMetricKeys.has(m.key)
                    );
                    if (filtered.length > 0) {
                      rowGroupedOptions[section] = filtered;
                    }
                  }

                  return (
                    <div
                      key={adj.id}
                      className="flex items-center gap-3 p-3 bg-[rgb(var(--color-surface))] rounded-lg"
                    >
                      {/* Metric Dropdown with optgroup like Screening */}
                      <div className="flex-1">
                        <select
                          className="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-md text-sm bg-white"
                          value={adj.metric_name}
                          onChange={(e) =>
                            updateAdjustment(
                              adj.id,
                              "metric_name",
                              e.target.value
                            )
                          }
                          disabled={loadingMetrics}
                        >
                          <option value="">-- Select Metric --</option>
                          {Object.entries(rowGroupedOptions).map(
                            ([section, metrics]) => (
                              <optgroup key={section} label={section}>
                                {metrics.map((m) => (
                                  <option key={m.key} value={m.key}>
                                    {m.label}
                                  </option>
                                ))}
                              </optgroup>
                            )
                          )}
                        </select>
                        {loadingMetrics && (
                          <div className="text-xs text-[rgb(var(--color-text-subtle))] mt-1">
                            Loading scoring metrics…
                          </div>
                        )}
                        {!loadingMetrics &&
                          scoringMetricOptions.length === 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              No scoring metrics available.
                            </div>
                          )}
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSimulate}
              disabled={loading || !canRunSimulation}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-[rgb(var(--color-text))] flex items-center gap-2">
                📊 Simulation Results
              </h3>
              <div className="flex items-center gap-2">
                <Button variant="report" onClick={openSaveModal}>
                  Save to Reports
                </Button>
                {saveMessage && (
                  <span className="text-xs text-green-700">{saveMessage}</span>
                )}
              </div>
            </div>

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
            {resultWeightLabel && (
              <div className="mb-2 text-xs text-[rgb(var(--color-text-subtle))]">
                Weights applied:
                <span className="ml-2 inline-flex items-center rounded bg-[rgb(var(--color-border))] px-2 py-1 text-[rgb(var(--color-text))]">
                  {resultWeightLabel}
                </span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-white rounded-lg border border-[rgb(var(--color-border))]">
                <div className="text-sm text-[rgb(var(--color-text-subtle))] mb-1">
                  Baseline Score ({result.baseline_year})
                </div>
                <div className="text-2xl font-bold text-[rgb(var(--color-primary))]">
                  {formatNumber(result.baseline_score, 4)}
                </div>
              </div>

              <div className="text-center p-4 bg-white rounded-lg border border-[rgb(var(--color-border))]">
                <div className="text-sm text-[rgb(var(--color-text-subtle))] mb-1">
                  Simulated Score ({result.simulation_year})
                </div>
                <div className="text-2xl font-bold text-[rgb(var(--color-action))]">
                  {formatNumber(result.simulated_score, 4)}
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
                  {formatSigned(result.delta, 4)}
                </div>
                <div
                  className={`text-sm ${getDeltaColor(result.delta_percent)}`}
                >
                  ({formatSigned(result.delta_percent, 2)}%)
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
                      <th className="px-4 py-2 text-left">Section</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-right">
                        Baseline Value ({result.baseline_year})
                      </th>
                      <th className="px-4 py-2 text-right">
                        Simulated Value ({result.simulation_year})
                      </th>
                      <th className="px-4 py-2 text-right">Adjustment (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedAdjustmentRows.map((d) => {
                      const sectionLabel =
                        (d.section && sectionLabelByKey[d.section]) ||
                        d.section ||
                        "";

                      const percent = d.adjustment_percent;
                      const reasonParts: string[] = [];
                      if (d.reason) {
                        if (d.reason.toLowerCase().includes("missing")) {
                          reasonParts.push("Data not available");
                        } else {
                          reasonParts.push(d.reason);
                        }
                      }
                      if (d.out_of_range || d.capped) {
                        reasonParts.push("Outside baseline range; capped.");
                      }
                      if (d.affects_score === false) {
                        reasonParts.push("Does not affect score");
                      }
                      const note = reasonParts.filter(Boolean).join(" ");

                      return (
                        <tr
                          key={`${d.metric_name}-${d.section || ""}`}
                          className="border-b border-[rgb(var(--color-border))]"
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium">{d.metric_name}</div>
                            {note && (
                              <div className="text-xs text-[rgb(var(--color-text-subtle))]">
                                {note}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-left">
                            {sectionLabel || ""}
                          </td>
                          <td className="px-4 py-2 text-left capitalize">
                            {d.type ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {d.baselineDisplay ??
                              formatValueForMetric(d, d.baseline_value)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {d.simulatedDisplay ??
                              formatValueForMetric(d, d.simulated_value)}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-bold ${
                              percent >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {percent >= 0 ? "+" : ""}
                            {percent}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      )}

      {saveOpen && (
        <Modal title="Save to Reports" onClose={() => setSaveOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[rgb(var(--color-text))]">
                Report Name
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded border border-[rgb(var(--color-border))] px-3 py-2 text-sm"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Simulation report name"
              />
            </div>
            {saveError && (
              <div className="text-sm text-red-600">{saveError}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="report"
                onClick={handleSaveReport}
                disabled={savingReport}
              >
                {savingReport ? "Saving..." : "Save to Reports"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Simulation;
