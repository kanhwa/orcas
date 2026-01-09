/**
 * ORCAS API Client
 * Uses fetch with credentials: "include" for cookie-based session auth.
 */

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export const BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL || "http://localhost:8000"
);

// =============================================================================
// Types
// =============================================================================

export interface User {
  id: number;
  username: string;
  email: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UpdateProfileRequest {
  username?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface MetricWeightInput {
  metric_name: string;
  type: "benefit" | "cost";
  weight: number;
}

export interface WSMScoreRequest {
  year: number;
  metrics: MetricWeightInput[];
  tickers?: string[] | null;
  limit?: number | null;
  missing_policy?: "redistribute" | "zero" | "drop";
}

export interface WSMRankingItem {
  ticker: string;
  score: number;
}

export interface WSMScoreResponse {
  year: number;
  ranking: WSMRankingItem[];
}

export interface SectionRankingRequest {
  section: "cashflow" | "balance" | "income";
  year: number;
  limit?: number | null;
  missing_policy?: "redistribute" | "zero" | "drop";
}

export interface SectionRankingResponse {
  year: number;
  section: string;
  ranking: WSMRankingItem[];
}

export interface ApiError {
  detail: string;
}

export interface StockResponse {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number | null;
  status: "open" | "closed";
  lastUpdate: string;
  disclaimer: string;
}

export interface StockListResponse {
  stocks: StockResponse[];
  count: number;
  marketStatus: "open" | "closed";
}

// =============================================================================
// Helper
// =============================================================================

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include", // CRITICAL: send cookies for session auth
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      detail: response.statusText,
    }));
    throw {
      status: response.status,
      detail: errorBody.detail || "Unknown error",
    };
  }

  // Handle empty response (e.g., 204 No Content)
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

// =============================================================================
// Auth API
// =============================================================================

export async function authLogin(
  username: string,
  password: string
): Promise<User> {
  return request<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password } satisfies LoginRequest),
  });
}

export async function authMe(): Promise<User> {
  return request<User>("/api/auth/me", {
    method: "GET",
  });
}

export async function authLogout(): Promise<{ detail: string }> {
  return request<{ detail: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function updateProfile(
  payload: UpdateProfileRequest
): Promise<User> {
  return request<User>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(
  payload: ChangePasswordRequest
): Promise<{ detail: string }> {
  return request<{ detail: string }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/api/auth/avatar`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res
      .json()
      .catch(() => ({ detail: res.statusText }));
    throw {
      status: res.status,
      detail: errorBody.detail || "Avatar upload failed",
    };
  }

  return res.json();
}

export async function deleteAvatar(): Promise<User> {
  return request<User>("/api/auth/avatar", {
    method: "DELETE",
  });
}

// =============================================================================
// Admin API (User Management)
// =============================================================================

export async function adminResetPassword(
  userId: number,
  newPassword: string
): Promise<User> {
  return request<User>(`/api/admin/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password: newPassword }),
  });
}

export async function adminEditUsername(
  userId: number,
  newUsername: string
): Promise<User> {
  return request<User>(`/api/admin/users/${userId}/username`, {
    method: "PATCH",
    body: JSON.stringify({ username: newUsername }),
  });
}

// =============================================================================
// WSM API
// =============================================================================

export async function wsmScore(
  payload: WSMScoreRequest
): Promise<WSMScoreResponse> {
  return request<WSMScoreResponse>("/api/wsm/score", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sectionRanking(
  payload: SectionRankingRequest
): Promise<SectionRankingResponse> {
  return request<SectionRankingResponse>("/api/wsm/section-ranking", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Simulation API
// =============================================================================

export interface MetricOverride {
  metric_name: string;
  value: number;
}

export interface SimulationRequest {
  ticker: string;
  year: number;
  mode: "overall" | "section";
  section?: "cashflow" | "balance" | "income" | null;
  overrides: MetricOverride[];
  missing_policy?: "redistribute" | "zero" | "drop";
}

export interface SimulationResponse {
  ticker: string;
  year: number;
  mode: string;
  section?: string | null;
  baseline_score?: number | null;
  simulated_score?: number | null;
  delta?: number | null;
  applied_overrides?: MetricOverride[] | null;
  message?: string | null;
}

export async function simulate(
  payload: SimulationRequest
): Promise<SimulationResponse> {
  return request<SimulationResponse>("/api/wsm/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Compare API
// =============================================================================

export interface CompareRequest {
  tickers: string[];
  year_from: number;
  year_to: number;
  mode: "overall" | "section";
  section?: "income" | "balance" | "cashflow" | null;
  missing_policy?: "redistribute" | "zero" | "drop";
}

export interface TickerSeries {
  ticker: string;
  scores: (number | null)[];
  missing_years: number[];
}

export interface CompareResponse {
  years: number[];
  series: TickerSeries[];
}

export async function compare(
  payload: CompareRequest
): Promise<CompareResponse> {
  return request<CompareResponse>("/api/wsm/compare", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Metrics Catalog API
// =============================================================================

export interface MetricInfo {
  key: string;
  label: string;
  description: string;
}

export interface SectionInfo {
  key: string;
  label: string;
  description: string;
  metrics: MetricInfo[];
}

export interface MissingPolicyOption {
  key: string;
  label: string;
  description: string;
}

export interface ModeOption {
  key: string;
  label: string;
  description: string;
}

export interface MetricsCatalog {
  sections: SectionInfo[];
  missing_policy_options: MissingPolicyOption[];
  modes: ModeOption[];
}

export async function getMetricsCatalog(): Promise<MetricsCatalog> {
  return request<MetricsCatalog>("/api/wsm/metrics-catalog", {
    method: "GET",
  });
}

// =============================================================================
// Years API (Dropdown)
// =============================================================================

export interface YearsResponse {
  years: number[];
}

export async function getYears(): Promise<YearsResponse> {
  return request<YearsResponse>("/api/years", { method: "GET" });
}

// =============================================================================
// Emitens API (Dropdown)
// =============================================================================

export interface EmitenItem {
  ticker_code: string;
  bank_name: string | null;
}

export interface EmitensResponse {
  items: EmitenItem[];
}

export async function getEmitens(): Promise<EmitensResponse> {
  return request<EmitensResponse>("/api/emitens", { method: "GET" });
}

// =============================================================================
// Scoring Runs API (History)
// =============================================================================

export interface ScoringRunSummary {
  id: number;
  year: number;
  template_id: number | null;
  created_at: string;
}

export interface ScoringRunListResponse {
  total: number;
  runs: ScoringRunSummary[];
}

export interface ScoringRunItemOut {
  emiten_id: number;
  ticker: string;
  score: number;
  rank: number;
  breakdown: Record<string, unknown> | null;
}

export interface ScoringRunDetail {
  id: number;
  year: number;
  template_id: number | null;
  request: Record<string, unknown>;
  created_at: string;
  items: ScoringRunItemOut[];
}

export async function getScoringRuns(
  skip = 0,
  limit = 20,
  year?: number
): Promise<ScoringRunListResponse> {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
  });
  if (year) params.set("year", String(year));
  return request<ScoringRunListResponse>(`/api/scoring-runs?${params}`, {
    method: "GET",
  });
}

export async function getScoringRunDetail(
  runId: number
): Promise<ScoringRunDetail> {
  return request<ScoringRunDetail>(`/api/scoring-runs/${runId}`, {
    method: "GET",
  });
}

export async function deleteScoringRun(runId: number): Promise<void> {
  return request<void>(`/api/scoring-runs/${runId}`, { method: "DELETE" });
}

// =============================================================================
// Templates API
// =============================================================================

export interface TemplateMetricConfig {
  metric_name: string;
  type: "benefit" | "cost";
  weight: number;
}

export interface TemplateOut {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  metrics_config: TemplateMetricConfig[];
  visibility: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateListResponse {
  total: number;
  templates: TemplateOut[];
}

export interface TemplateCreateRequest {
  name: string;
  description?: string | null;
  metrics_config: TemplateMetricConfig[];
  visibility?: "private" | "public";
}

export interface TemplateUpdateRequest {
  name?: string;
  description?: string | null;
  metrics_config?: TemplateMetricConfig[];
  visibility?: "private" | "public";
}

export async function getTemplates(
  skip = 0,
  limit = 20,
  mineOnly = false
): Promise<TemplateListResponse> {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
    mine_only: String(mineOnly),
  });
  return request<TemplateListResponse>(`/api/templates?${params}`, {
    method: "GET",
  });
}

export async function getTemplate(templateId: number): Promise<TemplateOut> {
  return request<TemplateOut>(`/api/templates/${templateId}`, {
    method: "GET",
  });
}

export async function createTemplate(
  payload: TemplateCreateRequest
): Promise<TemplateOut> {
  return request<TemplateOut>("/api/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTemplate(
  templateId: number,
  payload: TemplateUpdateRequest
): Promise<TemplateOut> {
  return request<TemplateOut>(`/api/templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTemplate(templateId: number): Promise<void> {
  return request<void>(`/api/templates/${templateId}`, { method: "DELETE" });
}

// =============================================================================
// Activity API (Dashboard)
// =============================================================================

export interface ScoringResultSummary {
  id: number;
  year: number;
  calculated_at: string;
}

export interface ComparisonSummary {
  id: number;
  created_at: string;
}

export interface SimulationSummary {
  id: number;
  created_at: string;
}

export interface RecentActivityResponse {
  scoring: ScoringResultSummary[];
  comparisons: ComparisonSummary[];
  simulations: SimulationSummary[];
}

export async function getRecentActivity(
  limit = 5
): Promise<RecentActivityResponse> {
  return request<RecentActivityResponse>(
    `/api/activity/recent?limit=${limit}`,
    {
      method: "GET",
    }
  );
}

// =============================================================================
// Financial Data API
// =============================================================================

export interface FinancialDataItem {
  ticker: string;
  metric_name: string;
  section: string;
  year: number;
  value: number | null;
}

export interface FinancialDataResponse {
  total: number;
  data: FinancialDataItem[];
}

export async function getFinancialData(params: {
  tickers: string;
  metrics?: string;
  section?: string;
  year_from?: number;
  year_to?: number;
}): Promise<FinancialDataResponse> {
  const searchParams = new URLSearchParams({ tickers: params.tickers });
  if (params.metrics) searchParams.set("metrics", params.metrics);
  if (params.section) searchParams.set("section", params.section);
  if (params.year_from) searchParams.set("year_from", String(params.year_from));
  if (params.year_to) searchParams.set("year_to", String(params.year_to));
  return request<FinancialDataResponse>(`/api/financial-data?${searchParams}`, {
    method: "GET",
  });
}

// =============================================================================
// Export API
// =============================================================================

export function getExportScoringRunUrl(
  runId: number,
  format: "csv" | "json" | "pdf" = "csv"
): string {
  return `${BASE_URL}/api/export/scoring/${runId}?format=${format}`;
}

export function getExportAllScoringRunsUrl(
  format: "csv" | "json" = "csv",
  year?: number
): string {
  const params = new URLSearchParams({ format });
  if (year) params.set("year", String(year));
  return `${BASE_URL}/api/export/scoring-runs?${params}`;
}

// =============================================================================
// Screening & Metrics API
// =============================================================================

export type FilterOperator = ">" | "<" | ">=" | "<=" | "=" | "between";

export interface MetricUnitConfig {
  unit?: string | null;
  scale?: string | null;
  allow_negative?: boolean | null;
}

export interface MetricItem {
  id: number;
  metric_name: string;
  display_name_en: string;
  section: string;
  type: string | null;
  description?: string | null;
  unit_config?: MetricUnitConfig | null;
}

export interface MetricSummaryResponse {
  metric_id: number;
  display_name_en: string;
  year: number;
  type: string | null;
  unit_config?: MetricUnitConfig | null;
  has_data: boolean;
  min: number | null;
  median: number | null;
  max: number | null;
  missing_count: number;
  total_count: number;
}

export async function getMetrics(): Promise<MetricItem[]> {
  return request<MetricItem[]>("/api/metrics", { method: "GET" });
}

export async function getMetricSummary(
  metricId: number,
  year: number
): Promise<MetricSummaryResponse> {
  const params = new URLSearchParams({ year: String(year) });
  return request<MetricSummaryResponse>(
    `/api/metrics/${metricId}/summary?${params}`,
    {
      method: "GET",
    }
  );
}

export interface MetricFilter {
  metric_id: number;
  operator: FilterOperator;
  value: number;
  value_max?: number | null;
}

export interface ScreeningRequest {
  year: number;
  filters: MetricFilter[];
}

export interface ConditionSummary {
  metric_id: number;
  metric_name: string;
  display_name_en: string;
  operator: FilterOperator;
  value: number;
  value_max?: number | null;
  has_data: boolean;
  unit_config?: MetricUnitConfig | null;
}

export interface ScreenedEmiten {
  ticker: string;
  name: string;
  values: Record<string, number | null>;
}

export interface ScreeningStats {
  total: number;
  passed: number;
  missing_data_banks: number;
}

export interface ScreeningResponse {
  year: number;
  conditions: ConditionSummary[];
  stats: ScreeningStats;
  passed: ScreenedEmiten[];
  has_data: boolean;
}

export async function screenEmitens(
  payload: ScreeningRequest
): Promise<ScreeningResponse> {
  return request<ScreeningResponse>("/api/screening", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getScreeningMetrics(): Promise<MetricItem[]> {
  return request<MetricItem[]>("/api/screening/metrics", {
    method: "GET",
  });
}

// =============================================================================
// Metric Ranking API
// =============================================================================

export interface MetricRankingRequest {
  metric_id?: number;
  metric_name?: string;
  year_from: number;
  year_to: number;
  top_n?: number;
}

export interface RankingItem {
  ticker: string;
  name: string;
  value: number | null;
  rank: number;
}

export interface YearlyRanking {
  year: number;
  rankings: RankingItem[];
}

export interface MetricRankingResponse {
  metric_name: string;
  display_name_en?: string | null;
  metric_type: string;
  years: number[];
  yearly_rankings: YearlyRanking[];
}

export async function getMetricRanking(
  payload: MetricRankingRequest
): Promise<MetricRankingResponse> {
  return request<MetricRankingResponse>("/api/metric-ranking", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface MetricPanelResponseRow {
  ticker: string;
  name: string;
  values: Record<string, number | null>;
}

export interface MetricPanelResponse {
  metric_id: number;
  metric_name: string;
  display_name_en?: string | null;
  metric_type?: string | null;
  from_year: number;
  to_year: number;
  rank_year: number;
  top_n: number;
  rows: MetricPanelResponseRow[];
}

export interface MetricYearTopResponse {
  metric_id: number;
  metric_name: string;
  display_name_en?: string | null;
  metric_type?: string | null;
  year: number;
  top_n: number;
  rankings: RankingItem[];
}

export async function getMetricRankingPanel(params: {
  metric_id: number;
  from_year: number;
  to_year: number;
  top_n: number;
  rank_year?: number;
}): Promise<MetricPanelResponse> {
  const search = new URLSearchParams({
    metric_id: String(params.metric_id),
    from_year: String(params.from_year),
    to_year: String(params.to_year),
    top_n: String(params.top_n),
  });
  if (params.rank_year) search.set("rank_year", String(params.rank_year));
  return request<MetricPanelResponse>(`/api/metric-ranking/panel?${search}`, {
    method: "GET",
  });
}

export async function getMetricRankingByYear(params: {
  metric_id: number;
  year: number;
  top_n: number;
}): Promise<MetricYearTopResponse> {
  const search = new URLSearchParams({
    metric_id: String(params.metric_id),
    year: String(params.year),
    top_n: String(params.top_n),
  });
  return request<MetricYearTopResponse>(
    `/api/metric-ranking/by-year?${search}`,
    { method: "GET" }
  );
}

export async function getAvailableMetrics(): Promise<MetricItem[]> {
  return request<MetricItem[]>("/api/metric-ranking/available-metrics", {
    method: "GET",
  });
}

// =============================================================================
// Historical Comparison API
// =============================================================================

export interface HistoricalCompareRequest {
  ticker: string;
  year1: number;
  year2: number;
}

export interface MetricComparison {
  metric_name: string;
  section: string;
  metric_type: string;
  value_year1: number | null;
  value_year2: number | null;
  delta: number | null;
  pct_change: number | null;
  trend: "up" | "down" | "stable" | "n/a";
  is_significant: boolean;
}

export interface HistoricalCompareResponse {
  ticker: string;
  name: string;
  year1: number;
  year2: number;
  metrics: MetricComparison[];
  summary: {
    improved: number;
    declined: number;
    stable: number;
    na: number;
  };
}

export async function historicalCompare(
  payload: HistoricalCompareRequest
): Promise<HistoricalCompareResponse> {
  return request<HistoricalCompareResponse>("/api/historical/compare", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
