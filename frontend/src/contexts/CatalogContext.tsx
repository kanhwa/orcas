import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getMetricsCatalog,
  MetricInfo,
  MetricsCatalog,
  MissingPolicyOption,
  ModeOption,
  SectionInfo,
} from "../services/api";

// =============================================================================
// Context Types
// =============================================================================

interface MetricOption {
  value: string;
  label: string;
  section?: string;
  description?: string;
}

interface CatalogContextValue {
  catalog: MetricsCatalog | null;
  loading: boolean;
  error: string | null;
  retry: () => void;

  // Helper functions
  getMetricsBySection: (sectionKey: string) => MetricInfo[];
  getMetricMeta: (metricKey: string) => MetricInfo | null;
  getSectionMeta: (sectionKey: string) => SectionInfo | null;
  getModeOptions: () => ModeOption[];
  getMissingPolicyOptions: () => MissingPolicyOption[];
  getYearOptions: () => number[];
  getMetricOptions: (sectionKey?: string) => MetricOption[];
}

const CatalogContext = createContext<CatalogContextValue | undefined>(
  undefined
);

// =============================================================================
// Provider
// =============================================================================

interface CatalogProviderProps {
  children: ReactNode;
}

export function CatalogProvider({ children }: CatalogProviderProps) {
  const [catalog, setCatalog] = useState<MetricsCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMetricsCatalog();
      setCatalog(data);
    } catch (err) {
      console.error("Failed to load metrics catalog:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load metrics catalog. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // =============================================================================
  // Helper Functions
  // =============================================================================

  const getMetricsBySection = (sectionKey: string): MetricInfo[] => {
    if (!catalog) return [];
    const section = catalog.sections.find((s) => s.key === sectionKey);
    return section?.metrics || [];
  };

  const getMetricMeta = (metricKey: string): MetricInfo | null => {
    if (!catalog) return null;
    for (const section of catalog.sections) {
      const metric = section.metrics.find((m) => m.key === metricKey);
      if (metric) return metric;
    }
    return null;
  };

  const getSectionMeta = (sectionKey: string): SectionInfo | null => {
    if (!catalog) return null;
    return catalog.sections.find((s) => s.key === sectionKey) || null;
  };

  const getModeOptions = (): ModeOption[] => {
    return catalog?.modes || [];
  };

  const getMissingPolicyOptions = (): MissingPolicyOption[] => {
    return catalog?.missing_policy_options || [];
  };

  const getYearOptions = (): number[] => {
    // Static range 2015-2024 based on data/processed/*.csv
    const years: number[] = [];
    for (let year = 2015; year <= 2024; year++) {
      years.push(year);
    }
    return years;
  };

  const getMetricOptions = (sectionKey?: string): MetricOption[] => {
    if (!catalog) return [];
    
    const metrics: MetricInfo[] = sectionKey
      ? getMetricsBySection(sectionKey)
      : catalog.sections.flatMap((s) => s.metrics);
    
    // Guard: Verify all metrics have keys (development check)
    const missingKeys = metrics.filter((m) => !m.key);
    if (missingKeys.length > 0) {
      console.warn(
        "WARNING: Metrics without keys detected:",
        missingKeys.map((m) => m.label)
      );
    }
    
    return metrics.map((m) => ({
      value: m.key,
      label: m.label,
      description: m.description,
      section: sectionKey,
    }));
  };

  const value: CatalogContextValue = {
    catalog,
    loading,
    error,
    retry: loadCatalog,
    getMetricsBySection,
    getMetricMeta,
    getSectionMeta,
    getModeOptions,
    getMissingPolicyOptions,
    getYearOptions,
    getMetricOptions,
  };

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error("useCatalog must be used within CatalogProvider");
  }
  return context;
}
