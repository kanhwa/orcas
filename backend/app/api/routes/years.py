from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models import User
from app.schemas.years import YearsResponse

router = APIRouter(prefix="/api/years", tags=["years"])

# Path to processed data
DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "processed"


@router.get("", response_model=YearsResponse)
def list_available_years(
    _current_user: User = Depends(get_current_user),
) -> YearsResponse:
    """
    Return list of available years from processed CSV files.
    Scans data/processed/*.csv for YYYY.csv pattern.
    """
    years = []
    if DATA_DIR.exists():
        for f in DATA_DIR.iterdir():
            if f.suffix == ".csv" and f.stem.isdigit():
                years.append(int(f.stem))
    years.sort(reverse=True)  # Most recent first
    return YearsResponse(years=years)
