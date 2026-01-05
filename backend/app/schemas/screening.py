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
    metric_name: str = Field(..., description="Name of the metric to filter")
    operator: FilterOperator = Field(..., description="Comparison operator")
    value: float = Field(..., description="Threshold value (or min for between)")
    value_max: Optional[float] = Field(None, description="Max value for between operator")


class ScreeningRequest(BaseModel):
    """Request for screening emitens."""
    year: int = Field(..., ge=2015, le=2030, description="Year of data")
    filters: List[MetricFilter] = Field(..., min_length=1, description="List of filter conditions")


class ScreenedEmiten(BaseModel):
    """Single emiten that passed all filters."""
    ticker: str
    name: str
    metrics: dict  # metric_name -> value


class ScreeningResponse(BaseModel):
    """Response for screening request."""
    year: int
    filters_applied: int
    total_matched: int
    emitens: List[ScreenedEmiten]
