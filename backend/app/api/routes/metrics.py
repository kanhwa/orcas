from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, FinancialData, MetricDefinition, User
from app.schemas.metrics import MetricOut, MetricSummaryResponse

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


def _metric_to_out(m: MetricDefinition) -> MetricOut:
    return MetricOut(
        id=m.id,
        metric_name=m.metric_name,
        display_name_en=m.display_name_en,
        section=m.section.value if m.section else "",
        type=m.type.value if m.type else None,
        description=m.description,
        unit_config=m.unit_config,
    )


@router.get("", response_model=list[MetricOut])
def list_metrics(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[MetricOut]:
    metrics = (
        db.query(MetricDefinition)
        .order_by(MetricDefinition.section, MetricDefinition.display_name_en)
        .all()
    )
    return [_metric_to_out(m) for m in metrics]


@router.get("/{metric_id}/summary", response_model=MetricSummaryResponse)
def metric_summary(
    metric_id: int,
    year: int = Query(..., ge=2010, le=2100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> MetricSummaryResponse:
    metric = db.get(MetricDefinition, metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    total_emitens = db.query(Emiten).count()

    stats_query = (
        db.query(
            func.min(FinancialData.value),
            func.max(FinancialData.value),
            func.count(FinancialData.value),
            func.percentile_cont(0.5).within_group(FinancialData.value),
        )
        .filter(FinancialData.metric_id == metric_id, FinancialData.year == year)
    )
    min_v, max_v, count_v, median_v = stats_query.one()

    missing_count = max(total_emitens - (count_v or 0), 0)
    has_data = bool(count_v and count_v > 0)

    return MetricSummaryResponse(
        metric_id=metric_id,
        display_name_en=metric.display_name_en,
        year=year,
        type=metric.type.value if metric.type else None,
        unit_config=metric.unit_config,
        has_data=has_data,
        min=float(min_v) if min_v is not None else None,
        median=float(median_v) if median_v is not None else None,
        max=float(max_v) if max_v is not None else None,
        missing_count=missing_count,
        total_count=total_emitens,
    )
