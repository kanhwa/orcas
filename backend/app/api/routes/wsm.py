from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.wsm import WSMScoreRequest, WSMScoreResponse
from app.services.wsm_service import calculate_wsm_score

router = APIRouter(prefix="/api/wsm", tags=["wsm"])


@router.post("/score", response_model=WSMScoreResponse)
def wsm_score(payload: WSMScoreRequest, db: Session = Depends(get_db)) -> WSMScoreResponse:
    return calculate_wsm_score(db, payload)
