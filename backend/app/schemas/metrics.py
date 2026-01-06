from __future__ import annotations

from typing import Optional, Any
from pydantic import BaseModel, Field


class MetricUnitConfig(BaseModel):
    unit: Optional[str] = Field(None, description="Display unit, e.g. %, IDR bn, x")
    scale: Optional[str] = Field(None, description="ratio or absolute")
    allow_negative: Optional[bool] = Field(None, description="Whether negative values are allowed")


class MetricOut(BaseModel):
    id: int
    metric_name: str
    display_name_en: str
    section: str
    type: str | None
    description: str | None = None
    unit_config: MetricUnitConfig | None = None


class MetricSummaryResponse(BaseModel):
    metric_id: int
    display_name_en: str
    year: int
    type: str | None
    unit_config: MetricUnitConfig | None = None
    has_data: bool
    min: float | None
    median: float | None
    max: float | None
    missing_count: int
    total_count: int
