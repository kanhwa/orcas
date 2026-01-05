from __future__ import annotations

# pylint: disable=not-callable

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import DISABLED_METRICS
from app.models import Emiten, FinancialData, MetricDefinition, User
from app.schemas.ranking import SectionRankingRequest, SectionRankingResponse
from app.schemas.wsm import MetricWeightInput, WSMScoreRequest
from app.services.wsm_service import calculate_wsm_score

router = APIRouter(prefix="/api/wsm", tags=["wsm"])

ALLOWED_SECTIONS = {"cashflow", "balance", "income"}
MIN_COVERAGE_RATIO = 0.70  # 70% minimum coverage


@router.post("/section-ranking", response_model=SectionRankingResponse)
def section_ranking(
    payload: SectionRankingRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> SectionRankingResponse:
    if payload.section not in ALLOWED_SECTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid section. Allowed sections: {', '.join(sorted(ALLOWED_SECTIONS))}.",
        )

    # Get all metrics for the section, excluding disabled ones
    metrics = (
        db.query(MetricDefinition)
        .filter(MetricDefinition.section == payload.section)
        .filter(~MetricDefinition.metric_name.in_(DISABLED_METRICS))
        .all()
    )
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No metric definitions found for section: {payload.section}.",
        )

    # Get total emiten count for coverage calculation
    total_emitens = db.query(func.count(1)).select_from(Emiten).scalar() or 0
    if total_emitens == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No emitens found in database.",
        )

    # Calculate coverage for each metric in the requested year
    metric_ids = [m.id for m in metrics]
    coverage_query = (
        db.query(
            FinancialData.metric_id,
            func.count(func.distinct(FinancialData.emiten_id)).label("covered"),  # type: ignore
        )
        .filter(FinancialData.year == payload.year)
        .filter(FinancialData.metric_id.in_(metric_ids))
        .filter(FinancialData.value.isnot(None))
        .group_by(FinancialData.metric_id)
    )
    coverage_by_metric_id = {row.metric_id: row.covered for row in coverage_query.all()}

    # Filter metrics by coverage threshold
    min_coverage_count = int(total_emitens * MIN_COVERAGE_RATIO)
    filtered_metrics: List[MetricDefinition] = []
    skipped_metrics: List[str] = []

    for metric in metrics:
        covered = coverage_by_metric_id.get(metric.id, 0)
        if covered >= min_coverage_count:
            filtered_metrics.append(metric)
        else:
            skipped_metrics.append(f"{metric.metric_name} ({covered}/{total_emitens})")

    if not filtered_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No metrics in section '{payload.section}' have sufficient coverage (>={MIN_COVERAGE_RATIO*100:.0f}%) "
                f"for year {payload.year}. Skipped: {', '.join(skipped_metrics[:5])}"
                + (f" and {len(skipped_metrics)-5} more" if len(skipped_metrics) > 5 else "")
            ),
        )

    metric_inputs = []
    for metric in filtered_metrics:
        weight = getattr(metric, "default_weight", None)
        if weight is None or weight <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid default_weight for metric: {metric.metric_name}.",
            )
        metric_inputs.append(
            MetricWeightInput(
                metric_name=metric.metric_name,
                type=metric.type,
                weight=weight,
            )
        )

    wsm_request = WSMScoreRequest(
        year=payload.year,
        metrics=metric_inputs,
        tickers=None,
        limit=payload.limit,
        missing_policy="zero",  # Default to zero for section ranking
    )
    result = calculate_wsm_score(db, wsm_request)
    return SectionRankingResponse(year=result.year, section=payload.section, ranking=result.ranking)


# =============================================================================
# MANUAL TEST (curl)
# =============================================================================
#
# 1) Section-ranking cashflow — sukses (200), hanya metric dengan coverage >= 70%:
#
#    curl -X POST http://localhost:8000/api/wsm/section-ranking \
#         -H "Content-Type: application/json" \
#         -d '{"section": "cashflow", "year": 2023, "limit": 10}'
#
# 2) Score dengan missing_policy "zero" (default) — missing metrics = score 0:
#
#    curl -X POST http://localhost:8000/api/wsm/score \
#         -H "Content-Type: application/json" \
#         -d '{
#           "year": 2023,
#           "metrics": [
#             {"metric_name": "Laba Bersih Tahun Berjalan", "type": "benefit", "weight": 1},
#             {"metric_name": "Total Ekuitas", "type": "benefit", "weight": 1}
#           ],
#           "missing_policy": "zero"
#         }'
#
# 3) Score dengan missing_policy "redistribute" — bobot didistribusi ulang:
#
#    curl -X POST http://localhost:8000/api/wsm/score \
#         -H "Content-Type: application/json" \
#         -d '{
#           "year": 2023,
#           "metrics": [
#             {"metric_name": "Laba Bersih Tahun Berjalan", "type": "benefit", "weight": 1},
#             {"metric_name": "Total Ekuitas", "type": "benefit", "weight": 1}
#           ],
#           "missing_policy": "redistribute"
#         }'
#
# 4) Score dengan missing_policy "drop" — ticker tanpa semua metric di-exclude:
#
#    curl -X POST http://localhost:8000/api/wsm/score \
#         -H "Content-Type: application/json" \
#         -d '{
#           "year": 2023,
#           "metrics": [
#             {"metric_name": "Laba Bersih Tahun Berjalan", "type": "benefit", "weight": 1},
#             {"metric_name": "Total Ekuitas", "type": "benefit", "weight": 1}
#           ],
#           "missing_policy": "drop"
#         }'
#
# 5) Score dengan metric disabled — gagal (400):
#
#    curl -X POST http://localhost:8000/api/wsm/score \
#         -H "Content-Type: application/json" \
#         -d '{
#           "year": 2023,
#           "metrics": [
#             {"metric_name": "Operating Cash Flow", "type": "benefit", "weight": 1}
#           ]
#         }'
#
#    Expected: {"detail":"Metric tidak diizinkan: Operating Cash Flow..."}
#
