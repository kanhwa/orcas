"""Schemas for stock screening feature."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class FilterOperator(str, Enum):
    """Filter operators for screening."""
    GT = ">"
    LT = "<"
    GTE = ">="
    LTE = "<="
    EQ = "="
    BETWEEN = "between"


class MetricFilter(BaseModel):
    """Single metric filter condition."""
    metric_id: int = Field(..., description="ID of the metric to filter")
    operator: FilterOperator = Field(..., description="Comparison operator")
    value: float = Field(..., description="Threshold value (or min for between)")
    value_max: Optional[float] = Field(None, description="Max value for between operator")


class ScreeningRequest(BaseModel):
    """Request for screening emitens."""
    year: int = Field(..., ge=2015, le=2030, description="Year of data")
    filters: List[MetricFilter] = Field(..., min_length=1, description="List of filter conditions")


class ConditionSummary(BaseModel):
    metric_id: int
    metric_name: str
    display_name_en: str
    operator: FilterOperator
    value: float
    value_max: Optional[float] = None
    has_data: bool
    unit_config: dict | None = None


class ScreenedEmiten(BaseModel):
    """Single emiten that passed all filters."""
    ticker: str
    name: str
    values: dict  # metric_id -> value


class ScreeningStats(BaseModel):
    total: int
    passed: int
    missing_data_banks: int


class ScreeningResponse(BaseModel):
    """Response for screening request."""
    year: int
    conditions: List[ConditionSummary]
    stats: ScreeningStats
    passed: List[ScreenedEmiten]
    has_data: bool
