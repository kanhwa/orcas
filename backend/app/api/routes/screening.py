"""Screening API routes for flexible stock filtering."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, FinancialData, MetricDefinition, User
from app.schemas.screening import (
    FilterOperator,
    MetricFilter,
    ScreenedEmiten,
    ScreeningRequest,
    ScreeningResponse,
    ConditionSummary,
    ScreeningStats,
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
    metric_ids = [f.metric_id for f in payload.filters]

    metrics = db.query(MetricDefinition).filter(
        MetricDefinition.id.in_(metric_ids)
    ).all()

    metric_map = {m.id: m for m in metrics}
    missing = set(metric_ids) - set(metric_map.keys())
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown metric ids: {sorted(missing)}")
    
    # Get all emitens
    emitens = db.query(Emiten).all()
    emiten_map = {e.id: e for e in emitens}
    
    # Get financial data for all emitens and requested metrics
    financial_data = (
        db.query(FinancialData)
        .filter(
            FinancialData.year == payload.year,
            FinancialData.metric_id.in_(metric_ids),
        )
        .all()
    )

    # Build lookup: emiten_id -> metric_id -> value
    data_lookup: dict[int, dict[int, float | None]] = {}

    for fd in financial_data:
        if fd.emiten_id not in data_lookup:
            data_lookup[fd.emiten_id] = {}
        data_lookup[fd.emiten_id][fd.metric_id] = float(fd.value) if fd.value is not None else None
    
    # Apply all filters to each emiten
    matched_emitens: list[ScreenedEmiten] = []
    missing_data_banks = 0

    for emiten_id, emiten in emiten_map.items():
        emiten_metrics = data_lookup.get(emiten_id, {})

        # If any metric is missing value, count missing_data_banks
        if any(emiten_metrics.get(f.metric_id) is None for f in payload.filters):
            missing_data_banks += 1

        all_passed = True
        for f in payload.filters:
            value = emiten_metrics.get(f.metric_id)
            if not apply_filter(value, f):
                all_passed = False
                break

        if all_passed:
            matched_emitens.append(
                ScreenedEmiten(
                    ticker=emiten.ticker_code,
                    name=emiten.bank_name or emiten.ticker_code,
                    values=emiten_metrics,
                )
            )

    # Sort by first metric value (descending)
    first_metric = payload.filters[0].metric_id
    matched_emitens.sort(key=lambda e: e.values.get(first_metric) or 0, reverse=True)

    # Condition summaries
    conditions: list[ConditionSummary] = []
    has_data = True
    for f in payload.filters:
        metric = metric_map[f.metric_id]
        non_null_count = (
            db.query(FinancialData)
            .filter(
                FinancialData.metric_id == f.metric_id,
                FinancialData.year == payload.year,
                FinancialData.value.isnot(None),
            )
            .count()
        )
        condition_has_data = non_null_count > 0
        if not condition_has_data:
            has_data = False
        conditions.append(
            ConditionSummary(
                metric_id=metric.id,
                metric_name=metric.metric_name,
                display_name_en=metric.display_name_en,
                operator=f.operator,
                value=f.value,
                value_max=f.value_max,
                has_data=condition_has_data,
                unit_config=metric.unit_config,
            )
        )

    stats = ScreeningStats(
        total=len(emiten_map),
        passed=len(matched_emitens),
        missing_data_banks=missing_data_banks,
    )

    return ScreeningResponse(
        year=payload.year,
        conditions=conditions,
        stats=stats,
        passed=matched_emitens,
        has_data=has_data,
    )


@router.get("/metrics")
def get_screening_metrics(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get list of available metrics for screening with their sections."""
    metrics = (
        db.query(MetricDefinition)
        .order_by(MetricDefinition.section, MetricDefinition.display_name_en)
        .all()
    )

    return [
        {
            "id": m.id,
            "name": m.metric_name,
            "display_name_en": m.display_name_en,
            "section": m.section.value if m.section else "",
            "type": m.type.value if m.type else None,
            "description": m.description or "",
            "unit_config": m.unit_config,
        }
        for m in metrics
    ]
