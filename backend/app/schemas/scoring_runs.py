from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ScoringRunItemOut(BaseModel):
    emiten_id: int
    ticker: str
    score: float
    rank: int
    breakdown: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ScoringRunSummary(BaseModel):
    id: int
    year: int
    template_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ScoringRunDetail(BaseModel):
    id: int
    year: int
    template_id: Optional[int] = None
    request: Dict[str, Any]
    created_at: datetime
    items: List[ScoringRunItemOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ScoringRunListResponse(BaseModel):
    total: int
    runs: List[ScoringRunSummary]
