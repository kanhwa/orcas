from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class EmitenOut(BaseModel):
    ticker_code: str
    bank_name: Optional[str] = None


class EmitensListResponse(BaseModel):
    items: List[EmitenOut]
