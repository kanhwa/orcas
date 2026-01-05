from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, FinancialData, MetricDefinition, User
from app.schemas.financial_data import FinancialDataItem, FinancialDataResponse

router = APIRouter(prefix="/api/financial-data", tags=["financial-data"])


@router.get("", response_model=FinancialDataResponse)
def get_financial_data(
    tickers: str = Query(..., description="Comma-separated ticker codes"),
    metrics: str | None = Query(default=None, description="Comma-separated metric names (optional)"),
    section: str | None = Query(default=None, description="Filter by section: income, balance, cashflow"),
    year_from: int | None = Query(default=None, ge=2010, le=2030),
    year_to: int | None = Query(default=None, ge=2010, le=2030),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> FinancialDataResponse:
    """
    Query financial data for specified tickers.
    Used for detailed charts and tables.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        return FinancialDataResponse(total=0, data=[])

    # Build query
    query = (
        db.query(
            Emiten.ticker_code,
            MetricDefinition.metric_name,
            MetricDefinition.section,
            FinancialData.year,
            FinancialData.value,
        )
        .join(Emiten, FinancialData.emiten_id == Emiten.id)
        .join(MetricDefinition, FinancialData.metric_id == MetricDefinition.id)
        .filter(Emiten.ticker_code.in_(ticker_list))
    )

    if section:
        query = query.filter(MetricDefinition.section == section)

    if metrics:
        metric_list = [m.strip() for m in metrics.split(",") if m.strip()]
        if metric_list:
            query = query.filter(MetricDefinition.metric_name.in_(metric_list))

    if year_from:
        query = query.filter(FinancialData.year >= year_from)
    if year_to:
        query = query.filter(FinancialData.year <= year_to)

    query = query.order_by(Emiten.ticker_code, FinancialData.year, MetricDefinition.metric_name)

    rows = query.all()

    data = [
        FinancialDataItem(
            ticker=r.ticker_code,
            metric_name=r.metric_name,
            section=r.section.value if hasattr(r.section, "value") else str(r.section),
            year=r.year,
            value=float(r.value) if r.value is not None else None,
        )
        for r in rows
    ]

    return FinancialDataResponse(total=len(data), data=data)
