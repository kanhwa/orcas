/**
 * ORCAS API Client
 * Uses fetch with credentials: "include" for cookie-based session auth.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// =============================================================================
// Types
// =============================================================================

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  role: string;
  status: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  full_name?: string | null;
  company?: string | null;
}

export interface UpdateProfileRequest {
  full_name?: string | null;
  company?: string | null;
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

export async function authRegister(payload: RegisterRequest): Promise<User> {
  return request<User>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
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
