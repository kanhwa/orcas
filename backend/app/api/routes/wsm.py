from __future__ import annotations

import hashlib
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import redis

from app.api.deps import get_current_user, get_db, get_redis
from app.core.config import settings
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


def _cache_key(prefix: str, *, user_id: int | None, payload: dict, extra: dict | None = None) -> str:
    key_payload = {
        "user_id": user_id,
        "payload": payload,
        "extra": extra or {},
    }
    raw = json.dumps(key_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"orcas:{prefix}:{digest}"


def _try_get_cached(redis_client: redis.Redis | None, key: str) -> dict | None:
    if not settings.REDIS_CACHE_ENABLED or redis_client is None:
        return None
    try:
        cached = redis_client.get(key)
        if not cached:
            return None
        return json.loads(cached)
    except Exception:  # pylint: disable=broad-exception-caught
        return None


def _try_set_cached(redis_client: redis.Redis | None, key: str, value: dict) -> None:
    if not settings.REDIS_CACHE_ENABLED or redis_client is None:
        return
    try:
        redis_client.setex(
            key,
            int(settings.REDIS_CACHE_TTL_SECONDS),
            json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        )
    except Exception:  # pylint: disable=broad-exception-caught
        return


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
    redis_client: redis.Redis | None = Depends(get_redis),
) -> WSMScorePreviewResponse:
    """
    Return official scoring preview for a year without persisting a scoring run.
    Adds coverage and confidence per ticker and deterministic tie-break sorting.
    """
    cache_key = _cache_key(
        "wsm:score_preview",
        user_id=_current_user.id,
        payload=payload.model_dump(),
    )
    cached = _try_get_cached(redis_client, cache_key)
    if cached is not None:
        return WSMScorePreviewResponse.model_validate(cached)

    result = calculate_wsm_score_preview(db, payload, user_id=_current_user.id)
    _try_set_cached(redis_client, cache_key, result.model_dump())
    return result


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
    redis_client: redis.Redis | None = Depends(get_redis),
) -> SimulationResponse:
    """
    Simulate WSM score with metric overrides.
    Compare baseline vs simulated scores.
    """
    cache_key = _cache_key(
        "wsm:simulate",
        user_id=current_user.id,
        payload=payload.model_dump(),
        extra={"debugSim": debug_sim},
    )
    cached = _try_get_cached(redis_client, cache_key)
    if cached is not None:
        result = SimulationResponse.model_validate(cached)
    else:
        result = run_simulation(db, payload, user_id=current_user.id, debug=debug_sim)
        _try_set_cached(redis_client, cache_key, result.model_dump())
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
    redis_client: redis.Redis | None = Depends(get_redis),
) -> CompareResponse:
    """
    Compare WSM scores for multiple tickers (1-4) across a year range.
    Returns scores for each ticker per year.
    """
    cache_key = _cache_key(
        "wsm:compare",
        user_id=current_user.id,
        payload=payload.model_dump(),
    )
    cached = _try_get_cached(redis_client, cache_key)
    if cached is not None:
        result = CompareResponse.model_validate(cached)
    else:
        result = run_compare(db, payload, user_id=current_user.id)
        _try_set_cached(redis_client, cache_key, result.model_dump())
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

