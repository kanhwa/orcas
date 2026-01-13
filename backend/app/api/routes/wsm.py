from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Comparison, Emiten, ScoringResult, ScoringRun, ScoringRunItem, SimulationLog, User
from app.schemas.wsm import (
    CompareRequest,
    CompareResponse,
    ScorecardRequest,
    ScorecardResponse,
    MetricsCatalog,
    SimulationRequest,
    SimulationResponse,
    WSMScoreRequest,
    WSMScorePreviewResponse,
    WSMScoreResponse,
)
from app.services.wsm_service import (
    calculate_wsm_score,
    calculate_wsm_score_preview,
    compute_scorecard,
    get_metrics_catalog,
    run_compare,
    run_simulation,
)

router = APIRouter(prefix="/api/wsm", tags=["wsm"])


@router.post("/score", response_model=WSMScoreResponse)
def wsm_score(
    payload: WSMScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WSMScoreResponse:
    result = calculate_wsm_score(db, payload, user_id=current_user.id)
    try:
        # Normalized persisted run (for history/report)
        run = ScoringRun(
            user_id=current_user.id,
            template_id=payload.template_id,
            year=payload.year,
            request=payload.model_dump(),
        )
        db.add(run)
        db.flush()  # assign run.id

        tickers = [item.ticker for item in result.ranking]
        emiten_rows = db.query(Emiten.id, Emiten.ticker_code).filter(Emiten.ticker_code.in_(tickers)).all()
        emiten_id_by_ticker = {r.ticker_code: r.id for r in emiten_rows}

        for idx, item in enumerate(result.ranking, start=1):
            emiten_id = emiten_id_by_ticker.get(item.ticker)
            if emiten_id is None:
                continue
            db.add(
                ScoringRunItem(
                    run_id=run.id,
                    emiten_id=emiten_id,
                    score=item.score,
                    rank=idx,
                    breakdown=None,
                )
            )

        db.add(
            ScoringResult(
                user_id=current_user.id,
                template_id=payload.template_id,
                year=payload.year,
                request=payload.model_dump(),
                ranking=result.model_dump(),
            )
        )
        db.commit()
    except Exception:  # pylint: disable=broad-exception-caught
        db.rollback()
    return result


@router.post("/score-preview", response_model=WSMScorePreviewResponse)
def wsm_score_preview(
    payload: WSMScoreRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> WSMScorePreviewResponse:
    """
    Return official scoring preview for a year without persisting a scoring run.
    Adds coverage and confidence per ticker and deterministic tie-break sorting.
    """
    return calculate_wsm_score_preview(db, payload, user_id=_current_user.id)


@router.post("/scorecard", response_model=ScorecardResponse)
def wsm_scorecard(
    payload: ScorecardRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ScorecardResponse:
    return compute_scorecard(db, payload, user_id=_current_user.id)


@router.post("/simulate", response_model=SimulationResponse)
def simulate(
    payload: SimulationRequest,
    debug_sim: bool = Query(False, alias="debugSim"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SimulationResponse:
    """
    Simulate WSM score with metric overrides.
    Compare baseline vs simulated scores.
    """
    result = run_simulation(db, payload, user_id=current_user.id, debug=debug_sim)
    try:
        db.add(
            SimulationLog(
                user_id=current_user.id,
                request=payload.model_dump(),
                response=result.model_dump(),
            )
        )
        db.commit()
    except Exception:  # pylint: disable=broad-exception-caught
        db.rollback()
    return result


@router.post("/compare", response_model=CompareResponse)
def compare(
    payload: CompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompareResponse:
    """
    Compare WSM scores for multiple tickers (1-4) across a year range.
    Returns scores for each ticker per year.
    """
    result = run_compare(db, payload, user_id=current_user.id)
    try:
        db.add(
            Comparison(
                user_id=current_user.id,
                request=payload.model_dump(),
                response=result.model_dump(),
            )
        )
        db.commit()
    except Exception:  # pylint: disable=broad-exception-caught
        db.rollback()
    return result


@router.get("/metrics-catalog", response_model=MetricsCatalog)
def metrics_catalog(
    db: Session = Depends(get_db),
) -> MetricsCatalog:
    """
    Get catalog of available sections, metrics, modes, and missing policy options.
    Used to populate UI dropdowns dynamically.
    PUBLIC endpoint - no auth required for UI initialization.
    """
    return get_metrics_catalog(db)

