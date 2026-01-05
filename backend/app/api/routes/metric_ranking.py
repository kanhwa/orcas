"""Metric Ranking API - Top N emitens per metric across years."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, asc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, FinancialData, MetricDefinition, User
from app.schemas.metric_ranking import (
    MetricRankingRequest,
    MetricRankingResponse,
    YearlyRanking,
)

router = APIRouter(prefix="/api/metric-ranking", tags=["metric-ranking"])


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
    # Validate metric exists
    metric = db.query(MetricDefinition).filter(
        MetricDefinition.metric_name == payload.metric_name
    ).first()
    
    if not metric:
        raise HTTPException(status_code=400, detail=f"Unknown metric: {payload.metric_name}")
    
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
        metric_name=payload.metric_name,
        metric_type=metric.type.value if metric.type else "unknown",
        years=years,
        yearly_rankings=yearly_rankings
    )


@router.get("/available-metrics")
def get_available_metrics(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get list of metrics available for ranking."""
    metrics = db.query(MetricDefinition).order_by(
        MetricDefinition.section, MetricDefinition.metric_name
    ).all()
    
    return [
        {
            "name": m.metric_name,
            "section": m.section.value if m.section else "",
            "type": m.type.value if m.type else "unknown",
            "description": m.description or ""
        }
        for m in metrics
    ]
