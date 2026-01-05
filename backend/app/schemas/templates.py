from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class TemplateMetricConfig(BaseModel):
    metric_name: str
    type: Literal["benefit", "cost"]
    weight: float = Field(..., gt=0)


class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    metrics_config: List[TemplateMetricConfig]
    visibility: Literal["private", "public"] = "private"


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    metrics_config: Optional[List[TemplateMetricConfig]] = None
    visibility: Optional[Literal["private", "public"]] = None


class TemplateOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    metrics_config: List[Dict[str, Any]]
    visibility: str
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    total: int
    templates: List[TemplateOut]
