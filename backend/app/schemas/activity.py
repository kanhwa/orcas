from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class ScoringResultSummary(BaseModel):
    id: int
    year: int
    calculated_at: datetime


class ComparisonSummary(BaseModel):
    id: int
    created_at: datetime


class SimulationSummary(BaseModel):
    id: int
    created_at: datetime


class RecentActivityResponse(BaseModel):
    scoring: List[ScoringResultSummary] = Field(default_factory=list)
    comparisons: List[ComparisonSummary] = Field(default_factory=list)
    simulations: List[SimulationSummary] = Field(default_factory=list)
