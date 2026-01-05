"""Screening API routes for flexible stock filtering."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, FinancialData, MetricDefinition, User
from app.schemas.screening import (
    FilterOperator,
    MetricFilter,
    ScreenedEmiten,
    ScreeningRequest,
    ScreeningResponse,
)

router = APIRouter(prefix="/api/screening", tags=["screening"])


def apply_filter(value: float | None, f: MetricFilter) -> bool:
    """Check if a value passes a single filter condition."""
    if value is None:
        return False
    
    if f.operator == FilterOperator.GT:
        return value > f.value
    elif f.operator == FilterOperator.LT:
        return value < f.value
    elif f.operator == FilterOperator.GTE:
        return value >= f.value
    elif f.operator == FilterOperator.LTE:
        return value <= f.value
    elif f.operator == FilterOperator.EQ:
        return abs(value - f.value) < 0.0001  # Float comparison tolerance
    elif f.operator == FilterOperator.BETWEEN:
        if f.value_max is None:
            return value >= f.value
        return f.value <= value <= f.value_max
    return False


@router.post("", response_model=ScreeningResponse)
def screen_emitens(
    payload: ScreeningRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ScreeningResponse:
    """
    Screen emitens based on multiple metric filter conditions.
    
    Example filters:
    - ROA > 2%
    - Total Aset > 100000000000
    - NPL < 5%
    
    All conditions must be met (AND logic).
    """
    # Get metric names from filters
    metric_names = [f.metric_name for f in payload.filters]
    
    # Validate all metrics exist
    metrics = db.query(MetricDefinition).filter(
        MetricDefinition.metric_name.in_(metric_names)
    ).all()
    metric_map = {m.metric_name: m.id for m in metrics}
    
    missing = set(metric_names) - set(metric_map.keys())
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown metrics: {', '.join(missing)}"
        )
    
    # Get all emitens
    emitens = db.query(Emiten).all()
    emiten_map = {e.id: e for e in emitens}
    
    # Get financial data for all emitens and requested metrics
    financial_data = (
        db.query(FinancialData)
        .filter(
            FinancialData.year == payload.year,
            FinancialData.metric_id.in_(list(metric_map.values()))
        )
        .all()
    )
    
    # Build lookup: emiten_id -> metric_name -> value
    data_lookup: dict[int, dict[str, float | None]] = {}
    metric_id_to_name = {v: k for k, v in metric_map.items()}
    
    for fd in financial_data:
        if fd.emiten_id not in data_lookup:
            data_lookup[fd.emiten_id] = {}
        metric_name = metric_id_to_name.get(fd.metric_id)
        if metric_name:
            data_lookup[fd.emiten_id][metric_name] = fd.value
    
    # Apply all filters to each emiten
    matched_emitens: list[ScreenedEmiten] = []
    
    for emiten_id, emiten in emiten_map.items():
        emiten_metrics = data_lookup.get(emiten_id, {})
        
        # Check all filters (AND logic)
        all_passed = True
        for f in payload.filters:
            value = emiten_metrics.get(f.metric_name)
            if not apply_filter(value, f):
                all_passed = False
                break
        
        if all_passed:
            matched_emitens.append(ScreenedEmiten(
                ticker=emiten.ticker_code,
                name=emiten.bank_name or emiten.ticker_code,
                metrics=emiten_metrics
            ))
    
    # Sort by first metric value (descending)
    first_metric = payload.filters[0].metric_name
    matched_emitens.sort(
        key=lambda e: e.metrics.get(first_metric) or 0,
        reverse=True
    )
    
    return ScreeningResponse(
        year=payload.year,
        filters_applied=len(payload.filters),
        total_matched=len(matched_emitens),
        emitens=matched_emitens
    )


@router.get("/metrics")
def get_screening_metrics(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get list of available metrics for screening with their sections."""
    metrics = db.query(MetricDefinition).order_by(
        MetricDefinition.section, MetricDefinition.metric_name
    ).all()
    
    return [
        {
            "id": m.id,
            "name": m.metric_name,
            "section": m.section,
            "type": m.type,
            "description": m.description or ""
        }
        for m in metrics
    ]
