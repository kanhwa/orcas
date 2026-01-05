"""Schemas for metric ranking feature."""
from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class MetricRankingRequest(BaseModel):
    """Request for ranking emitens by a single metric."""
    metric_name: str = Field(..., description="Metric to rank by")
    year_from: int = Field(..., ge=2015, le=2030, description="Start year")
    year_to: int = Field(..., ge=2015, le=2030, description="End year")
    top_n: int = Field(default=3, ge=1, le=10, description="Number of top emitens per year")


class YearlyRanking(BaseModel):
    """Top N emitens for a single year."""
    year: int
    rankings: List[dict]  # [{ticker, name, value, rank}]


class MetricRankingResponse(BaseModel):
    """Response for metric ranking request."""
    metric_name: str
    metric_type: str  # benefit or cost
    years: List[int]
    yearly_rankings: List[YearlyRanking]
