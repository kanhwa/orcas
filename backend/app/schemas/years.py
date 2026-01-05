from __future__ import annotations

from typing import List

from pydantic import BaseModel


class YearsResponse(BaseModel):
    years: List[int]
