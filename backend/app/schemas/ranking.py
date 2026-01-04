from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.wsm import WSMRankingItem


class SectionRankingRequest(BaseModel):
    year: int
    section: Literal["cashflow", "balance", "income"]
    limit: Optional[int] = Field(default=5, ge=1, le=32)


class SectionRankingResponse(BaseModel):
    year: int
    section: str
    ranking: List[WSMRankingItem]
