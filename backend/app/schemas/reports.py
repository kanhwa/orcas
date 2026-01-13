from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_REPORT_TYPES = {
    "scoring_scorecard",
    "compare_stocks",
    "compare_historical",
    "simulation_scenario",
    "analysis_screening",
    "analysis_metric_ranking",
}


class ReportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., description="Report type identifier")
    pdf_base64: str = Field(..., description="Base64-encoded PDF content")
    metadata: Optional[Dict[str, Any]] = Field(default=None)

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        if value not in ALLOWED_REPORT_TYPES:
            raise ValueError("type must be one of: " + ", ".join(sorted(ALLOWED_REPORT_TYPES)))
        return value

    @field_validator("pdf_base64")
    @classmethod
    def validate_pdf(cls, value: str) -> str:
        if not value or not isinstance(value, str):
            raise ValueError("pdf_base64 is required")
        return value


class ReportRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class ReportListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None


class ReportDetail(ReportListItem):
    owner_user_id: int


class ReportListResponse(BaseModel):
    total: int
    items: List[ReportListItem]


class ReportCombineRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    ordered_report_ids: List[int] = Field(..., min_length=1)

    @field_validator("ordered_report_ids")
    @classmethod
    def validate_ids(cls, ids: List[int]) -> List[int]:
        if not ids or len(ids) < 2:
            raise ValueError("ordered_report_ids must contain at least two report ids to combine")
        if any(i <= 0 for i in ids):
            raise ValueError("ordered_report_ids must be positive integers")
        return ids
