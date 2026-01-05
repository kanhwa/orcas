from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.wsm import (
    CompareRequest,
    CompareResponse,
    MetricsCatalog,
    SimulationRequest,
    SimulationResponse,
    WSMScoreRequest,
    WSMScoreResponse,
)
from app.services.wsm_service import (
    calculate_wsm_score,
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
    return calculate_wsm_score(db, payload)


@router.post("/simulate", response_model=SimulationResponse)
def simulate(
    payload: SimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SimulationResponse:
    """
    Simulate WSM score with metric overrides.
    Compare baseline vs simulated scores.
    """
    return run_simulation(db, payload)


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
    return run_compare(db, payload)


@router.get("/metrics-catalog", response_model=MetricsCatalog)
def metrics_catalog(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MetricsCatalog:
    """
    Get catalog of available sections, metrics, modes, and missing policy options.
    Used to populate UI dropdowns dynamically.
    """
    return get_metrics_catalog(db)

