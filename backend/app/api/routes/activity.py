from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Comparison, ScoringResult, SimulationLog, User
from app.schemas.activity import (
    ComparisonSummary,
    RecentActivityResponse,
    ScoringResultSummary,
    SimulationSummary,
)

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("/recent", response_model=RecentActivityResponse)
def recent_activity(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecentActivityResponse:
    limit = max(1, min(limit, 20))

    scoring = (
        db.query(ScoringResult)
        .filter(ScoringResult.user_id == current_user.id)
        .order_by(ScoringResult.calculated_at.desc())
        .limit(limit)
        .all()
    )
    comparisons = (
        db.query(Comparison)
        .filter(Comparison.user_id == current_user.id)
        .order_by(Comparison.created_at.desc())
        .limit(limit)
        .all()
    )
    simulations = (
        db.query(SimulationLog)
        .filter(SimulationLog.user_id == current_user.id)
        .order_by(SimulationLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return RecentActivityResponse(
        scoring=[ScoringResultSummary(id=s.id, year=s.year, calculated_at=s.calculated_at) for s in scoring],
        comparisons=[ComparisonSummary(id=c.id, created_at=c.created_at) for c in comparisons],
        simulations=[SimulationSummary(id=s.id, created_at=s.created_at) for s in simulations],
    )
