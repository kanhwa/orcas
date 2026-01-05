from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class FinancialDataItem(BaseModel):
    ticker: str
    metric_name: str
    section: str
    year: int
    value: Optional[float] = None


class FinancialDataQuery(BaseModel):
    tickers: List[str] = Field(..., min_length=1, max_length=10)
    metrics: Optional[List[str]] = None  # None = all metrics
    section: Optional[Literal["income", "balance", "cashflow"]] = None
    year_from: Optional[int] = Field(default=None, ge=2010, le=2030)
    year_to: Optional[int] = Field(default=None, ge=2010, le=2030)


class FinancialDataResponse(BaseModel):
    total: int
    data: List[FinancialDataItem]
