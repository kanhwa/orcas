"""Historical Comparison API - Compare one emiten across two time periods."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, FinancialData, MetricDefinition, User
from app.schemas.historical import (
    HistoricalCompareRequest,
    HistoricalCompareResponse,
    MetricComparison,
)

router = APIRouter(prefix="/api/historical", tags=["historical"])


@router.post("/compare", response_model=HistoricalCompareResponse)
def historical_compare(
    payload: HistoricalCompareRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> HistoricalCompareResponse:
    """
    Compare all metrics for one emiten between two years.
    
    Returns delta values, percentage changes, and trend indicators.
    Highlights significant changes (>20%).
    """
    # Validate emiten exists
    emiten = db.query(Emiten).filter(Emiten.ticker_code == payload.ticker).first()
    if not emiten:
        raise HTTPException(status_code=400, detail=f"Unknown ticker: {payload.ticker}")
    
    # Get all metric definitions
    metrics = db.query(MetricDefinition).order_by(
        MetricDefinition.section, MetricDefinition.metric_name
    ).all()
    metric_map = {m.id: m for m in metrics}
    
    # Get financial data for both years
    data_year1 = (
        db.query(FinancialData)
        .filter(
            FinancialData.emiten_id == emiten.id,
            FinancialData.year == payload.year1
        )
        .all()
    )
    data_year2 = (
        db.query(FinancialData)
        .filter(
            FinancialData.emiten_id == emiten.id,
            FinancialData.year == payload.year2
        )
        .all()
    )
    
    # Build lookup by metric_id
    values_y1 = {fd.metric_id: fd.value for fd in data_year1}
    values_y2 = {fd.metric_id: fd.value for fd in data_year2}
    
    comparisons: list[MetricComparison] = []
    summary = {"improved": 0, "declined": 0, "stable": 0, "na": 0}
    
    for metric in metrics:
        v1 = values_y1.get(metric.id)
        v2 = values_y2.get(metric.id)
        
        # Calculate delta and percentage change
        delta = None
        pct_change = None
        trend = "n/a"
        is_significant = False
        
        if v1 is not None and v2 is not None:
            v1_float = float(v1)
            v2_float = float(v2)
            delta = v2_float - v1_float
            
            if v1_float != 0:
                pct_change = ((v2_float - v1_float) / abs(v1_float)) * 100
            elif v2_float != 0:
                pct_change = 100.0 if v2_float > 0 else -100.0
            else:
                pct_change = 0.0
            
            # Determine trend based on metric type
            is_benefit = metric.type and metric.type.value == "benefit"
            
            if abs(pct_change) < 5:
                trend = "stable"
                summary["stable"] += 1
            elif pct_change > 0:
                if is_benefit:
                    trend = "up"
                    summary["improved"] += 1
                else:  # cost metric: increase is bad
                    trend = "down"
                    summary["declined"] += 1
            else:
                if is_benefit:
                    trend = "down"
                    summary["declined"] += 1
                else:  # cost metric: decrease is good
                    trend = "up"
                    summary["improved"] += 1
            
            is_significant = abs(pct_change) > 20
        else:
            summary["na"] += 1
        
        comparisons.append(MetricComparison(
            metric_name=metric.metric_name,
            section=metric.section.value if metric.section else "",
            metric_type=metric.type.value if metric.type else "unknown",
            value_year1=float(v1) if v1 is not None else None,
            value_year2=float(v2) if v2 is not None else None,
            delta=delta,
            pct_change=pct_change,
            trend=trend,
            is_significant=is_significant
        ))
    
    return HistoricalCompareResponse(
        ticker=emiten.ticker_code,
        name=emiten.bank_name or emiten.ticker_code,
        year1=payload.year1,
        year2=payload.year2,
        metrics=comparisons,
        summary=summary
    )
