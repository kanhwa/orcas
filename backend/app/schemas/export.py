from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ExportScoringRequest(BaseModel):
    run_id: Optional[int] = None  # If provided, export specific run
    year: Optional[int] = None  # If no run_id, generate new scoring for this year
    format: Literal["pdf", "csv", "json"] = "pdf"


class ExportCompareRequest(BaseModel):
    tickers: List[str] = Field(..., min_length=1, max_length=4)
    year_from: int = Field(..., ge=2010, le=2030)
    year_to: int = Field(..., ge=2010, le=2030)
    mode: Literal["overall", "section"] = "overall"
    section: Optional[Literal["income", "balance", "cashflow"]] = None
    format: Literal["pdf", "csv", "json"] = "pdf"
