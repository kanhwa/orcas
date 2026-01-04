from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class MetricWeightInput(BaseModel):
    metric_name: str
    type: Literal["benefit", "cost"]
    weight: float = Field(..., gt=0, description="Weight must be greater than zero.")


class WSMScoreRequest(BaseModel):
    year: int
    metrics: List[MetricWeightInput]
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


class WSMScoreResponse(BaseModel):
    year: int
    ranking: List[WSMRankingItem]
