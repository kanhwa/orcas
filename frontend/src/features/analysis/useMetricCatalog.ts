import { useEffect, useState, useMemo } from "react";
import {
  getMetrics,
  getYears,
  getMetricSummary,
  MetricItem,
  MetricSummaryResponse,
} from "../../services/api";

/**
 * Single source of truth for Analysis (Screening + Metric Ranking) metrics.
 * Fetches metrics from backend catalog and provides organized access by section.
 * Metric names are EXACT dataset names - no translation or renaming.
 */
export function useMetricCatalog() {
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Fetch catalog on mount
  useEffect(() => {
    Promise.all([
      getMetrics()
        .then((list) => {
          setMetrics(list);
        })
        .catch((err) => {
          console.error("Failed to load metrics:", err);
          setError("Failed to load metrics catalog");
        }),
      getYears()
        .then((res) => {
          setYears(res.years || []);
        })
        .catch((err) => {
          console.error("Failed to load years:", err);
          setError("Failed to load years");
        }),
    ]).finally(() => {
      setCatalogLoading(false);
    });
  }, []);

  // Organize metrics by section
  const metricsBySection = useMemo(() => {
    return metrics.reduce((acc, m) => {
      if (!acc[m.section]) acc[m.section] = [];
      acc[m.section].push(m);
      return acc;
    }, {} as Record<string, MetricItem[]>);
  }, [metrics]);

  // Get metrics for a specific section
  const getMetricsForSection = (section: string): MetricItem[] => {
    return metricsBySection[section] || [];
  };

  // Get metric by ID
  const getMetricById = (id: number): MetricItem | undefined => {
    return metrics.find((m) => m.id === id);
  };

  // Fetch stats for a metric in a specific year
  const getMetricStats = async (
    metricId: number,
    year: number
  ): Promise<MetricSummaryResponse | null> => {
    try {
      return await getMetricSummary(metricId, year);
    } catch (err) {
      console.error("Failed to fetch metric stats:", err);
      return null;
    }
  };

  // All sections in order
  const sections = useMemo(() => {
    const sectionOrder = ["income", "balance", "cashflow"];
    return sectionOrder.filter((s) => metricsBySection[s]?.length > 0);
  }, [metricsBySection]);

  return {
    metrics,
    years,
    catalogLoading,
    error,
    metricsBySection,
    getMetricsForSection,
    getMetricById,
    getMetricStats,
    sections,
  };
}
