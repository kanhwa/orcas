from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import DISABLED_METRICS
from app.models import MetricDefinition
from app.schemas.ranking import SectionRankingRequest, SectionRankingResponse
from app.schemas.wsm import MetricWeightInput, WSMScoreRequest
from app.services.wsm_service import calculate_wsm_score

router = APIRouter(prefix="/api/wsm", tags=["wsm"])

ALLOWED_SECTIONS = {"cashflow", "balance", "income"}


@router.post("/section-ranking", response_model=SectionRankingResponse)
def section_ranking(payload: SectionRankingRequest, db: Session = Depends(get_db)) -> SectionRankingResponse:
    if payload.section not in ALLOWED_SECTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid section. Allowed sections: {', '.join(sorted(ALLOWED_SECTIONS))}.",
        )

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

    metric_inputs = []
    for metric in metrics:
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
    )
    result = calculate_wsm_score(db, wsm_request)
    return SectionRankingResponse(year=result.year, section=payload.section, ranking=result.ranking)


# =============================================================================
# MANUAL TEST (curl)
# =============================================================================
#
# 1) Section-ranking cashflow — harus sukses (200), "Operating Cash Flow" tidak muncul:
#
#    curl -X POST http://localhost:8000/api/wsm/section-ranking \
#         -H "Content-Type: application/json" \
#         -d '{"section": "cashflow", "year": 2023, "limit": 10}'
#
# 2) Score dengan metric disabled — harus gagal (400):
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
#    Expected response:
#    {"detail":"Metric tidak diizinkan: Operating Cash Flow. Gunakan 'Arus Kas Dari Aktivitas Operasi' sebagai gantinya."}
#
