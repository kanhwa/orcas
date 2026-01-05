"""Schemas for historical comparison feature."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class HistoricalCompareRequest(BaseModel):
    """Request to compare one emiten across two years."""
    ticker: str = Field(..., description="Emiten ticker code")
    year1: int = Field(..., ge=2015, le=2030, description="First year")
    year2: int = Field(..., ge=2015, le=2030, description="Second year")


class MetricComparison(BaseModel):
    """Single metric comparison between two years."""
    metric_name: str
    section: str
    metric_type: str  # benefit or cost
    value_year1: Optional[float]
    value_year2: Optional[float]
    delta: Optional[float]  # absolute change
    pct_change: Optional[float]  # percentage change
    trend: str  # "up", "down", "stable", "n/a"
    is_significant: bool  # change > 20%


class HistoricalCompareResponse(BaseModel):
    """Response for historical comparison."""
    ticker: str
    name: str
    year1: int
    year2: int
    metrics: List[MetricComparison]
    summary: dict  # {improved: int, declined: int, stable: int, na: int}
