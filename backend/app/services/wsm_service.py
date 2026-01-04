from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import DISABLED_METRICS
from app.models import Emiten, FinancialData, MetricDefinition
from app.schemas.wsm import (
    MetricWeightInput,
    WSMRankingItem,
    WSMScoreRequest,
    WSMScoreResponse,
)


def _normalize_weights(metrics: Iterable[MetricWeightInput]) -> Dict[str, float]:
    total_weight = sum(metric.weight for metric in metrics)
    if total_weight <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total weight must be greater than zero.",
        )
    return {metric.metric_name: metric.weight / total_weight for metric in metrics}


def _pick_metric_definitions(
    db: Session, metric_names: List[str]
) -> Dict[str, MetricDefinition]:
    definitions = (
        db.query(MetricDefinition)
        .filter(MetricDefinition.metric_name.in_(metric_names))
        .all()
    )
    if not definitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Metric definitions not found for the requested metrics.",
        )

    picked: Dict[str, MetricDefinition] = {}
    for name in metric_names:
        candidates = [definition for definition in definitions if definition.metric_name == name]
        if not candidates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Metric definition not found: {name}.",
            )
        preferred = next(
            (definition for definition in candidates if getattr(definition, "section", None) == "income"),
            candidates[0],
        )
        picked[name] = preferred
    return picked


def _fetch_financial_data(
    db: Session,
    year: int,
    metric_ids: List[int],
    tickers: List[str] | None,
) -> List[Tuple[str, int, float]]:
    query = (
        db.query(
            Emiten.ticker_code,
            FinancialData.metric_id,
            FinancialData.value,
        )
        .join(Emiten, FinancialData.emiten_id == Emiten.id)
        .filter(
            FinancialData.year == year,
            FinancialData.metric_id.in_(metric_ids),
        )
    )
    if tickers:
        query = query.filter(Emiten.ticker_code.in_(tickers))

    rows = query.all()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No financial data found for the requested year/metrics.",
        )
    return rows


def calculate_wsm_score(db: Session, payload: WSMScoreRequest) -> WSMScoreResponse:
    if not payload.metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one metric is required.",
        )

    disabled_in_request = [
        m.metric_name for m in payload.metrics if m.metric_name in DISABLED_METRICS
    ]
    if disabled_in_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Metric tidak diizinkan: {', '.join(disabled_in_request)}. Gunakan 'Arus Kas Dari Aktivitas Operasi' sebagai gantinya.",
        )

    normalized_weights = _normalize_weights(payload.metrics)
    definitions_by_name = _pick_metric_definitions(db, [metric.metric_name for metric in payload.metrics])

    metric_id_by_name = {name: definition.id for name, definition in definitions_by_name.items()}
    metric_type_by_id = {
        metric_id_by_name[metric.metric_name]: metric.type for metric in payload.metrics
    }
    weight_by_metric_id = {
        metric_id_by_name[metric.metric_name]: normalized_weights[metric.metric_name]
        for metric in payload.metrics
    }

    rows = _fetch_financial_data(
        db=db,
        year=payload.year,
        metric_ids=list(metric_id_by_name.values()),
        tickers=payload.tickers,
    )

    values_by_metric: Dict[int, List[Tuple[str, float]]] = {metric_id: [] for metric_id in metric_id_by_name.values()}
    ticker_metric_values: Dict[str, Dict[int, float]] = {}

    for ticker, metric_id, value in rows:
        if value is None:
            continue

        x = float(value)  # convert Decimal to float
        metric_type = metric_type_by_id[metric_id]
        adjusted_value = abs(x) if metric_type == "cost" and x < 0 else x
        ticker_metric_values.setdefault(ticker, {})[metric_id] = adjusted_value
        values_by_metric.setdefault(metric_id, []).append((ticker, adjusted_value))

    if not ticker_metric_values:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No usable financial data found (all values were NULL).",
        )

    max_by_metric: Dict[int, float] = {}
    min_by_metric: Dict[int, float] = {}
    for metric_id, items in values_by_metric.items():
        if not items:
            continue
        metrics_values = [item[1] for item in items]
        max_by_metric[metric_id] = max(metrics_values)
        min_by_metric[metric_id] = min(metrics_values)

    ranking: List[WSMRankingItem] = []
    requested_metric_ids = set(metric_id_by_name.values())

    for ticker, metrics_values in ticker_metric_values.items():
        available_metric_ids = set(metrics_values.keys())
        missing_metric_ids = requested_metric_ids - available_metric_ids

        # Handle missing_policy
        if payload.missing_policy == "drop":
            # Skip ticker if any metric is missing
            if missing_metric_ids:
                continue
            weight_divisor = 1.0  # all metrics present, no redistribution needed
        elif payload.missing_policy == "redistribute":
            # Old behavior: redistribute weights among available metrics
            available_weight_sum = sum(weight_by_metric_id[mid] for mid in available_metric_ids)
            if available_weight_sum <= 0:
                continue
            weight_divisor = available_weight_sum
        else:  # "zero" (default)
            # Keep total weight = 1, missing metrics contribute 0
            weight_divisor = 1.0

        score = 0.0
        for metric_id in available_metric_ids:
            metric_type = metric_type_by_id[metric_id]
            value = metrics_values[metric_id]

            if metric_type == "benefit":
                denominator = max_by_metric.get(metric_id, 0)
                raw = (value / denominator) if denominator else 0.0
                normalized_value = max(0.0, min(1.0, raw))  # clamp 0..1
            else:
                numerator = min_by_metric.get(metric_id, 0)
                if value == 0 or numerator == 0:
                    normalized_value = 0.0
                else:
                    raw = numerator / value
                    normalized_value = max(0.0, min(1.0, raw))  # clamp 0..1

            weight_share = weight_by_metric_id[metric_id] / weight_divisor
            score += weight_share * normalized_value

        # For "zero" policy, missing metrics contribute 0 (already handled by not adding to score)

        ranking.append(WSMRankingItem(ticker=ticker, score=round(score, 6)))

    ranking.sort(key=lambda item: item.score, reverse=True)
    if payload.limit:
        ranking = ranking[:payload.limit]

    if not ranking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ranking could be computed for the provided parameters.",
        )

    return WSMScoreResponse(year=payload.year, ranking=ranking)
