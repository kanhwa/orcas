"""Metric Ranking API - Top N emitens per metric across years."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, asc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, FinancialData, MetricDefinition, User
from app.schemas.metric_ranking import (
    MetricRankingRequest,
    MetricRankingResponse,
    YearlyRanking,
    MetricPanelResponse,
    MetricYearTopResponse,
)

from app.schemas.metrics import MetricOut

router = APIRouter(prefix="/api/metric-ranking", tags=["metric-ranking"])


def _get_sort_order(metric: MetricDefinition, rank_type: str = "best"):
    """
    Determine sort order based on metric type and rank_type.
    
    Args:
        metric: The metric definition
        rank_type: "best" or "worst" (default "best")
    
    Returns:
        SQLAlchemy order function (desc or asc)
    
    Logic:
    - Benefit metrics (higher is better):
        - best => DESC (highest first)
        - worst => ASC (lowest first)
    - Cost metrics (lower is better):
        - best => ASC (lowest first)
        - worst => DESC (highest first)
    """
    is_benefit = metric.type and metric.type.value == "benefit"
    
    if rank_type == "worst":
        # Invert the normal ordering
        return asc if is_benefit else desc
    else:
        # Normal "best" ordering (default)
        return desc if is_benefit else asc


def _resolve_metric(db: Session, payload: MetricRankingRequest) -> MetricDefinition:
    """Resolve metric by id or legacy metric_name."""
    if payload.metric_id:
        metric = db.get(MetricDefinition, payload.metric_id)
    else:
        metric = (
            db.query(MetricDefinition)
            .filter(MetricDefinition.metric_name == payload.metric_name)
            .first()
        )
    if not metric:
        raise HTTPException(status_code=400, detail="Unknown metric")
    return metric


@router.post("", response_model=MetricRankingResponse)
def get_metric_ranking(
    payload: MetricRankingRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> MetricRankingResponse:
    """
    Get top N emitens for a specific metric across multiple years.
    
    - Benefit metrics: higher is better (descending order)
    - Cost metrics: lower is better (ascending order)
    """
    metric = _resolve_metric(db, payload)
    
    # Validate year range
    if payload.year_from > payload.year_to:
        raise HTTPException(status_code=400, detail="year_from must be <= year_to")
    
    # Get all emitens
    emitens = db.query(Emiten).all()
    emiten_map = {e.id: e for e in emitens}
    
    # Determine sort order based on metric type
    is_benefit = metric.type and metric.type.value == "benefit"
    
    years = list(range(payload.year_from, payload.year_to + 1))
    yearly_rankings: list[YearlyRanking] = []
    
    for year in years:
        # Get financial data for this metric and year
        order_fn = desc if is_benefit else asc
        
        data = (
            db.query(FinancialData)
            .filter(
                FinancialData.metric_id == metric.id,
                FinancialData.year == year,
                FinancialData.value.isnot(None)
            )
            .order_by(order_fn(FinancialData.value))
            .limit(payload.top_n)
            .all()
        )
        
        rankings = []
        for rank, fd in enumerate(data, start=1):
            emiten = emiten_map.get(fd.emiten_id)
            if emiten:
                rankings.append({
                    "ticker": emiten.ticker_code,
                    "name": emiten.bank_name or emiten.ticker_code,
                    "value": float(fd.value) if fd.value else None,
                    "rank": rank
                })
        
        yearly_rankings.append(YearlyRanking(
            year=year,
            rankings=rankings
        ))
    
    return MetricRankingResponse(
        metric_name=metric.metric_name,
        display_name_en=metric.display_name_en,
        metric_type=metric.type.value if metric.type else "unknown",
        years=years,
        yearly_rankings=yearly_rankings,
    )


@router.get("/available-metrics", response_model=list[MetricOut])
def get_available_metrics(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[MetricOut]:
    """Get list of metrics available for ranking."""
    metrics = (
        db.query(MetricDefinition)
        .order_by(MetricDefinition.section, MetricDefinition.display_name_en)
        .all()
    )

    return [
        MetricOut(
            id=m.id,
            metric_name=m.metric_name,
            display_name_en=m.display_name_en,
            section=m.section.value if m.section else "",
            type=m.type.value if m.type else None,
            description=m.description,
            unit_config=m.unit_config,
        )
        for m in metrics
    ]


@router.get("/panel", response_model=MetricPanelResponse)
def metric_ranking_panel(
    metric_id: int = Query(..., ge=1),
    from_year: int = Query(..., ge=2015, le=2030),
    to_year: int = Query(..., ge=2015, le=2030),
    top_n: int = Query(3, ge=1, le=32),
    rank_year: int | None = None,
    rank_type: str = Query("best", pattern="^(best|worst)$"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> MetricPanelResponse:
    """
    Get multi-year panel data for top N emitens based on a specific metric.
    
    Args:
        rank_type: "best" (top performers) or "worst" (bottom performers)
    """
    metric = db.get(MetricDefinition, metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    if from_year > to_year:
        raise HTTPException(status_code=400, detail="from_year must be <= to_year")
    rank_year = rank_year or to_year

    order_fn = _get_sort_order(metric, rank_type)

    top_rows = (
        db.query(FinancialData)
        .filter(
            FinancialData.metric_id == metric_id,
            FinancialData.year == rank_year,
            FinancialData.value.isnot(None),
        )
        .order_by(order_fn(FinancialData.value))
        .limit(top_n)
        .all()
    )

    if not top_rows:
        return MetricPanelResponse(
            metric_id=metric.id,
            metric_name=metric.metric_name,
            display_name_en=metric.display_name_en,
            metric_type=metric.type.value if metric.type else None,
            from_year=from_year,
            to_year=to_year,
            rank_year=rank_year,
            top_n=0,
            rows=[],
        )

    top_emiten_ids = [r.emiten_id for r in top_rows]

    values = (
        db.query(FinancialData)
        .filter(
            FinancialData.metric_id == metric_id,
            FinancialData.emiten_id.in_(top_emiten_ids),
            FinancialData.year.between(from_year, to_year),
        )
        .all()
    )

    years = list(range(from_year, to_year + 1))
    value_map: dict[int, dict[int, float | None]] = {eid: {y: None for y in years} for eid in top_emiten_ids}
    for v in values:
        value_map[v.emiten_id][v.year] = float(v.value) if v.value is not None else None

    emiten_map = {e.id: e for e in db.query(Emiten).filter(Emiten.id.in_(top_emiten_ids)).all()}

    rows = []
    for r in top_rows:
        e = emiten_map.get(r.emiten_id)
        rows.append(
            {
                "ticker": e.ticker_code if e else str(r.emiten_id),
                "name": e.bank_name or (e.ticker_code if e else ""),
                "values": value_map.get(r.emiten_id, {}),
            }
        )

    return MetricPanelResponse(
        metric_id=metric.id,
        metric_name=metric.metric_name,
        display_name_en=metric.display_name_en,
        metric_type=metric.type.value if metric.type else None,
        from_year=from_year,
        to_year=to_year,
        rank_year=rank_year,
        top_n=len(rows),
        rows=rows,
    )


@router.get("/by-year", response_model=MetricYearTopResponse)
def metric_ranking_by_year(
    metric_id: int = Query(..., ge=1),
    year: int = Query(..., ge=2015, le=2030),
    top_n: int = Query(3, ge=1, le=32),
    rank_type: str = Query("best", pattern="^(best|worst)$"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> MetricYearTopResponse:
    """
    Get top N emitens for a single year based on a specific metric.
    
    Args:
        rank_type: "best" (top performers) or "worst" (bottom performers)
    """
    metric = db.get(MetricDefinition, metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    order_fn = _get_sort_order(metric, rank_type)

    data = (
        db.query(FinancialData)
        .filter(
            FinancialData.metric_id == metric_id,
            FinancialData.year == year,
            FinancialData.value.isnot(None),
        )
        .order_by(order_fn(FinancialData.value))
        .limit(top_n)
        .all()
    )

    emiten_map = {e.id: e for e in db.query(Emiten).all()}
    rankings = []
    for rank, fd in enumerate(data, start=1):
        e = emiten_map.get(fd.emiten_id)
        rankings.append(
            {
                "ticker": e.ticker_code if e else str(fd.emiten_id),
                "name": e.bank_name or (e.ticker_code if e else ""),
                "value": float(fd.value) if fd.value is not None else None,
                "rank": rank,
            }
        )

    return MetricYearTopResponse(
        metric_id=metric.id,
        metric_name=metric.metric_name,
        display_name_en=metric.display_name_en,
        metric_type=metric.type.value if metric.type else None,
        year=year,
        top_n=len(rankings),
        rankings=rankings,
    )
