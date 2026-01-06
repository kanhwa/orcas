"""Schemas for metric ranking feature."""
from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class MetricRankingRequest(BaseModel):
    """Request for ranking emitens by a single metric."""
    metric_id: int | None = Field(None, description="Metric id")
    metric_name: str | None = Field(None, description="Metric name (legacy)")
    year_from: int = Field(..., ge=2015, le=2030, description="Start year")
    year_to: int = Field(..., ge=2015, le=2030, description="End year")
    top_n: int = Field(default=3, ge=1, le=32, description="Number of top emitens per year")


class YearlyRanking(BaseModel):
    """Top N emitens for a single year."""
    year: int
    rankings: List[dict]  # [{ticker, name, value, rank}]


class MetricRankingResponse(BaseModel):
    """Response for metric ranking request."""
    metric_name: str
    display_name_en: str | None = None
    metric_type: str  # benefit or cost
    years: List[int]
    yearly_rankings: List[YearlyRanking]


class PanelRow(BaseModel):
    ticker: str
    name: str
    values: dict[int, float | None]  # year -> value


class MetricPanelResponse(BaseModel):
    metric_id: int
    metric_name: str
    display_name_en: str | None
    metric_type: str | None
    from_year: int
    to_year: int
    rank_year: int
    top_n: int
    rows: List[PanelRow]


class MetricYearTopResponse(BaseModel):
    metric_id: int
    metric_name: str
    display_name_en: str | None
    metric_type: str | None
    year: int
    top_n: int
    rankings: List[dict]
