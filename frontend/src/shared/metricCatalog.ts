import { MetricItem } from "../services/api";

export interface CatalogMetric {
  id: number;
  metric_name: string;
  display_name_en: string;
  section: string;
  type: string | null;
  description?: string | null;
  unit?: string | null;
  key: string; // For dropdown option key
  label: string; // For dropdown option label
}

export function toCatalogMetric(metric: MetricItem): CatalogMetric {
  return {
    id: metric.id,
    metric_name: metric.metric_name,
    display_name_en: metric.display_name_en,
    section: metric.section,
    type: metric.type,
    description: metric.description,
    unit: metric.unit_config?.unit || null,
    key: metric.metric_name, // Use metric_name as key for dropdown
    label: metric.display_name_en, // Use display_name_en as label for UI
  };
}
