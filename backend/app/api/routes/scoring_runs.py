from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db
from app.models import Emiten, ScoringRun, User
from app.schemas.scoring_runs import (
    ScoringRunDetail,
    ScoringRunItemOut,
    ScoringRunListResponse,
    ScoringRunSummary,
)

router = APIRouter(prefix="/api/scoring-runs", tags=["scoring-runs"])


@router.get("", response_model=ScoringRunListResponse)
def list_scoring_runs(
    skip: int = 0,
    limit: int = 20,
    year: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScoringRunListResponse:
    """
    List scoring runs for current user with optional year filter.
    Paginated via skip/limit.
    """
    limit = max(1, min(limit, 100))
    skip = max(0, skip)

    query = db.query(ScoringRun).filter(ScoringRun.user_id == current_user.id)
    if year is not None:
        query = query.filter(ScoringRun.year == year)

    total = query.count()
    runs = query.order_by(ScoringRun.created_at.desc()).offset(skip).limit(limit).all()

    return ScoringRunListResponse(
        total=total,
        runs=[
            ScoringRunSummary(
                id=r.id,
                year=r.year,
                template_id=r.template_id,
                created_at=r.created_at,
            )
            for r in runs
        ],
    )


@router.get("/{run_id}", response_model=ScoringRunDetail)
def get_scoring_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScoringRunDetail:
    """
    Get detail of a specific scoring run including all ranked items.
    """
    run = (
        db.query(ScoringRun)
        .options(joinedload(ScoringRun.items))
        .filter(ScoringRun.id == run_id, ScoringRun.user_id == current_user.id)
        .first()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Scoring run not found")

    # Get ticker codes for items
    emiten_ids = [item.emiten_id for item in run.items]
    emitens = db.query(Emiten.id, Emiten.ticker_code).filter(Emiten.id.in_(emiten_ids)).all()
    ticker_by_id = {e.id: e.ticker_code for e in emitens}

    items_out = [
        ScoringRunItemOut(
            emiten_id=item.emiten_id,
            ticker=ticker_by_id.get(item.emiten_id, "???"),
            score=float(item.score),
            rank=item.rank,
            breakdown=item.breakdown,
        )
        for item in sorted(run.items, key=lambda x: x.rank)
    ]

    return ScoringRunDetail(
        id=run.id,
        year=run.year,
        template_id=run.template_id,
        request=run.request,
        created_at=run.created_at,
        items=items_out,
    )


@router.delete("/{run_id}", status_code=204)
def delete_scoring_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a scoring run (and its items via cascade).
    """
    run = (
        db.query(ScoringRun)
        .filter(ScoringRun.id == run_id, ScoringRun.user_id == current_user.id)
        .first()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Scoring run not found")

    db.delete(run)
    db.commit()
