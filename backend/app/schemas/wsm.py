from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class MetricWeightInput(BaseModel):
    metric_name: str
    type: Literal["benefit", "cost"]
    weight: float = Field(..., ge=0, description="Weight must be non-negative.")


class WSMScoreRequest(BaseModel):
    template_id: Optional[int] = None
    weight_template_id: Optional[int] = Field(default=None, description="Optional weight template to apply")
    year: int
    metrics: Optional[List[MetricWeightInput]] = None
    weight_scope: Optional[Literal["metric", "section"]] = None
    weights_json: Optional[Dict[str, float]] = None
    tickers: Optional[List[str]] = None
    limit: Optional[int] = Field(
        default=None,
        ge=1,
        le=32,
        description="Optional limit for number of ranked tickers (1-32).",
    )
    missing_policy: Literal["redistribute", "zero", "drop"] = Field(
        default="zero",
        description=(
            "How to handle missing metrics per ticker: "
            "'redistribute' = redistribute weights among available metrics (old behavior), "
            "'zero' = missing metrics get normalized_value=0 (default), "
            "'drop' = exclude ticker if any metric is missing."
        ),
    )


class WSMRankingItem(BaseModel):
    ticker: str
    score: float


class DroppedTicker(BaseModel):
    ticker: str
    reason: str
    missing_metrics: List[str] | None = None


class CoverageSummary(BaseModel):
    used: int
    total: int
    pct: float


class WSMRankingPreviewItem(BaseModel):
    rank: int
    ticker: str
    score: float
    coverage: CoverageSummary
    confidence: Literal["High", "Medium", "Low"]


class WSMScorePreviewResponse(BaseModel):
    year: int
    missing_policy: Literal["redistribute", "zero", "drop"]
    ranking: List[WSMRankingPreviewItem]
    tie_breaker: List[str]
    dropped_tickers: List[DroppedTicker] = Field(default_factory=list)


class WSMScoreResponse(BaseModel):
    year: int
    ranking: List[WSMRankingItem]
    dropped_tickers: List[DroppedTicker] = Field(default_factory=list)


# =============================================================================
# Simulation
# =============================================================================


class MetricOverride(BaseModel):
    metric_name: str
    value: float


class SimulationRequest(BaseModel):
    ticker: str
    year: int
    mode: Literal["overall", "section"]
    section: Optional[Literal["income", "balance", "cashflow"]] = None
    overrides: List[MetricOverride] = Field(default_factory=list)
    missing_policy: Literal["redistribute", "zero", "drop"] = "zero"


class SimulationAdjustmentDetail(BaseModel):
    metric_key: Optional[str] = None
    metric_name: str
    section: Optional[str] = None
    type: Optional[Literal["benefit", "cost"]] = None
    baseline_value: Optional[float] = None
    simulated_value: Optional[float] = None
    adjustment_percent: float
    affects_score: bool = True
    out_of_range: bool = False
    capped: bool = False
    ignored: bool = False
    reason: Optional[str] = None
    unmatched_reason: Optional[str] = None


class SimulationResponse(BaseModel):
    ticker: str
    year: int
    mode: str
    section: Optional[str] = None
    baseline_score: Optional[float] = None
    simulated_score: Optional[float] = None
    delta: Optional[float] = None
    applied_overrides: List[MetricOverride] = Field(default_factory=list)
    adjustments_detail: List[SimulationAdjustmentDetail] = Field(default_factory=list)
    message: Optional[str] = None
    debug: Optional["SimulationDebugInfo"] = None


class SimulationDebugInfo(BaseModel):
    metrics_used_count: int
    requested_metric_count: int
    total_weight_used: float
    normalization_year: int
    normalization_scope: str
    weights_renormalized: bool


# =============================================================================
# Compare
# =============================================================================


class CompareRequest(BaseModel):
    tickers: List[str] = Field(..., min_length=1, max_length=4)
    year_from: int = Field(..., ge=2010, le=2030)
    year_to: int = Field(..., ge=2010, le=2030)
    mode: Literal["overall", "section"]
    section: Optional[Literal["income", "balance", "cashflow"]] = None
    missing_policy: Literal["redistribute", "zero", "drop"] = "zero"
    weight_template_id: Optional[int] = None
    weight_scope: Optional[Literal["metric", "section"]] = None
    weights_json: Optional[Dict[str, float]] = None


class TickerSeries(BaseModel):
    ticker: str
    scores: List[Optional[float]]
    missing_years: List[int] = Field(default_factory=list)


class CompareResponse(BaseModel):
    years: List[int]
    series: List[TickerSeries]
    dropped_tickers: List[DroppedTicker] = Field(default_factory=list)


# =============================================================================
# Metrics Catalog
# =============================================================================


class MetricInfo(BaseModel):
    key: str
    label: str
    description: str = ""
    type: Optional[Literal["benefit", "cost"]] = None
    default_weight: Optional[float] = None


class SectionInfo(BaseModel):
    key: str
    label: str
    description: str = ""
    metrics: List[MetricInfo] = Field(default_factory=list)


class MissingPolicyOption(BaseModel):
    key: str
    label: str
    description: str = ""


class ModeOption(BaseModel):
    key: str
    label: str
    description: str = ""


class MetricsCatalog(BaseModel):
    sections: List[SectionInfo]
    missing_policy_options: List[MissingPolicyOption]
    modes: List[ModeOption]


# =============================================================================
# Scorecard
# =============================================================================


class ScorecardRequest(BaseModel):
    year: int
    ticker: str
    missing_policy: Literal["redistribute", "zero", "drop"] = "zero"
    weight_template_id: Optional[int] = None
    weight_scope: Literal["metric", "section"] | None = None
    weights_json: Dict[str, float] | None = None


class ScorecardCoverage(BaseModel):
    used: int
    total: int
    pct: float
    missing: List[str]


class ScorecardSectionSubtotals(BaseModel):
    balance: float
    income: float
    cash_flow: float


class ScorecardMetric(BaseModel):
    metric_name: str
    section: Literal["balance", "income", "cash_flow"]
    type: Literal["benefit", "cost"]
    display_unit: str
    allow_negative: bool
    raw_value: float | None
    normalized_value: float
    default_weight: float
    effective_weight: float
    contribution: float
    is_missing: bool


class ScorecardSectionBreakdown(BaseModel):
    section: Literal["balance", "income", "cash_flow"]
    score: float
    effective_weight_pct: float


class ScorecardResponse(BaseModel):
    year: int
    ticker: str
    total_score: float
    rank: int
    coverage: ScorecardCoverage
    confidence: Literal["High", "Medium", "Low"]
    section_breakdown: List[ScorecardSectionBreakdown]
    section_subtotals: ScorecardSectionSubtotals
    tie_breaker: List[str]
    metrics: List[ScorecardMetric]
