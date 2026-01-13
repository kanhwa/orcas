from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import DISABLED_METRICS
from app.models import Comparison, Emiten, FinancialData, MetricDefinition, ScoringResult, SimulationLog, WeightTemplate
from app.schemas.wsm import (
    CompareRequest,
    CompareResponse,
    CoverageSummary,
    DroppedTicker,
    MetricInfo,
    MetricsCatalog,
    MetricWeightInput,
    MissingPolicyOption,
    ModeOption,
    ScorecardCoverage,
    ScorecardMetric,
    ScorecardRequest,
    ScorecardResponse,
    ScorecardSectionSubtotals,
    SectionInfo,
    SimulationAdjustmentDetail,
    SimulationDebugInfo,
    SimulationRequest,
    SimulationResponse,
    TickerSeries,
    WSMRankingItem,
    WSMRankingPreviewItem,
    WSMScorePreviewResponse,
    WSMScoreRequest,
    WSMScoreResponse,
)
from app.services.metric_mapping_loader import (
    MetricMappingEntry,
    load_metric_mapping_dict,
    load_metric_mapping_list,
)


# =============================================================================
# Weight helpers
# =============================================================================


def _normalize_section_key(section: str) -> str:
    key = (section or "").strip().lower()
    if key in {"cashflow", "cash_flow", "cash flow"}:
        return "cash_flow"
    if key in {"balance", "balance sheet"}:
        return "balance"
    if key in {"income", "income statement"}:
        return "income"
    return key or "unknown"


def _clean_weight_numbers(weights: Dict[str, float]) -> Dict[str, float]:
    cleaned: Dict[str, float] = {}
    for key, raw in weights.items():
        if raw is None:
            continue
        if not isinstance(raw, (int, float)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Weights must be numbers.",
            )
        if raw < 0 or raw > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Weights must be between 0 and 100.",
            )
        cleaned[key] = float(raw)
    return cleaned


def _normalize_weight_map(weights: Dict[str, float]) -> Dict[str, float]:
    cleaned = _clean_weight_numbers(weights)
    total = sum(cleaned.values())
    if total <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total weight must be greater than zero.",
        )
    return {k: (v / total if total else 0.0) for k, v in cleaned.items()}


def _load_weight_template_owned(db: Session, template_id: int, user_id: int | None) -> WeightTemplate:
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required for templates.")

    template = (
        db.query(WeightTemplate)
        .filter(WeightTemplate.id == template_id, WeightTemplate.owner_user_id == user_id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


def _prepare_mapping_defaults() -> tuple[List[MetricMappingEntry], Dict[str, float], Dict[str, float]]:
    mapping_entries = load_metric_mapping_list()
    if not mapping_entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Metric mapping is empty.",
        )

    default_weight_raw = {
        entry.metric_name: max(entry.default_weight, 0.0) for entry in mapping_entries
    }
    total_weight = sum(default_weight_raw.values())
    if total_weight <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total weight from mapping must be greater than zero.",
        )

    normalized_default_weights = {
        name: value / total_weight for name, value in default_weight_raw.items()
    }
    return mapping_entries, default_weight_raw, normalized_default_weights


def _metric_weights_from_section(
    section_weights: Dict[str, float],
    mapping_entries: List[MetricMappingEntry],
    default_weight_raw: Dict[str, float],
    normalized_default_weights: Dict[str, float],
) -> Dict[str, float]:
    normalized_section_weights = _normalize_weight_map(
        {_normalize_section_key(k): v for k, v in section_weights.items()}
    )

    metrics_by_section: Dict[str, List[str]] = {"balance": [], "income": [], "cash_flow": []}
    for entry in mapping_entries:
        sec = _normalize_section_key(entry.section)
        if sec in metrics_by_section:
            metrics_by_section[sec].append(entry.metric_name)

    metric_weights: Dict[str, float] = {entry.metric_name: 0.0 for entry in mapping_entries}

    for section_key, metrics in metrics_by_section.items():
        section_weight = normalized_section_weights.get(section_key, 0.0)
        if not metrics:
            continue
        sec_default_sum = sum(default_weight_raw.get(m, 0.0) for m in metrics)
        if sec_default_sum <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Default weights must be positive for section {section_key}.",
            )
        for metric_name in metrics:
            share = default_weight_raw.get(metric_name, 0.0) / sec_default_sum
            metric_weights[metric_name] += section_weight * share

    return _normalize_weight_map(metric_weights)


def _resolve_metric_weight_map(
    weight_scope: str | None,
    weights_json: Dict[str, float] | None,
    mapping_entries: List[MetricMappingEntry],
    default_weight_raw: Dict[str, float],
    normalized_default_weights: Dict[str, float],
) -> Dict[str, float]:
    metric_names = {entry.metric_name for entry in mapping_entries}

    if weights_json is None or weight_scope is None:
        return normalized_default_weights

    if weight_scope not in {"metric", "section"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="weight_scope must be 'metric' or 'section'.",
        )

    if weight_scope == "metric":
        cleaned = _clean_weight_numbers(weights_json)
        unknown = [k for k in cleaned.keys() if k not in metric_names]
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown metrics in weights: {', '.join(unknown)}",
            )
        merged = {name: cleaned.get(name, 0.0) for name in metric_names}
        return _normalize_weight_map(merged)

    # section mode
    normalized_sections: Dict[str, float] = {}
    for raw_key, value in weights_json.items():
        normalized_sections[_normalize_section_key(raw_key)] = value
    return _metric_weights_from_section(normalized_sections, mapping_entries, default_weight_raw, normalized_default_weights)


def _metric_inputs_from_weight_map(
    mapping_entries: List[MetricMappingEntry], weight_map: Dict[str, float]
) -> List[MetricWeightInput]:
    metric_inputs: List[MetricWeightInput] = []
    for entry in mapping_entries:
        metric_inputs.append(
            MetricWeightInput(
                metric_name=entry.metric_name,
                type=entry.type or "benefit",  # type: ignore[arg-type]
                weight=weight_map.get(entry.metric_name, 0.0),
            )
        )
    return metric_inputs


def _resolve_metrics_from_source(
    db: Session,
    metrics: List[MetricWeightInput] | None,
    weight_template_id: int | None,
    weight_scope: str | None,
    weights_json: Dict[str, float] | None,
    user_id: int | None,
) -> List[MetricWeightInput]:
    if weight_template_id is not None:
        template = _load_weight_template_owned(db, weight_template_id, user_id)
        weight_scope = template.scope
        weights_json = template.weights_json
        metrics = None  # always derive from template

    if metrics:
        return metrics

    if weights_json is not None:
        mapping_entries, default_weight_raw, normalized_default_weights = _prepare_mapping_defaults()
        weight_map = _resolve_metric_weight_map(weight_scope, weights_json, mapping_entries, default_weight_raw, normalized_default_weights)
        return _metric_inputs_from_weight_map(mapping_entries, weight_map)

    # If nothing provided, fall back to default mapping-driven metrics
    mapping_entries, default_weight_raw, normalized_default_weights = _prepare_mapping_defaults()
    weight_map = _resolve_metric_weight_map("metric", normalized_default_weights, mapping_entries, default_weight_raw, normalized_default_weights)
    return _metric_inputs_from_weight_map(mapping_entries, weight_map)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


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


def _compute_confidence_label(pct: float) -> str:
    if pct >= 0.90:
        return "High"
    if pct >= 0.75:
        return "Medium"
    return "Low"


def _safe_commit(db: Session) -> None:
    try:
        db.commit()
    except Exception:  # pylint: disable=broad-exception-caught
        db.rollback()


def calculate_wsm_score(db: Session, payload: WSMScoreRequest, user_id: int | None = None) -> WSMScoreResponse:
    effective_metrics = _resolve_metrics_from_source(
        db,
        payload.metrics,
        payload.weight_template_id,
        payload.weight_scope,
        payload.weights_json,
        user_id,
    )

    if not effective_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one metric is required.",
        )

    disabled_in_request = [
        m.metric_name for m in effective_metrics if m.metric_name in DISABLED_METRICS
    ]
    if disabled_in_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Metric tidak diizinkan: {', '.join(disabled_in_request)}. Gunakan 'Arus Kas Dari Aktivitas Operasi' sebagai gantinya.",
        )

    normalized_weights = _normalize_weights(effective_metrics)
    definitions_by_name = _pick_metric_definitions(db, [metric.metric_name for metric in effective_metrics])

    metric_id_by_name = {name: definition.id for name, definition in definitions_by_name.items()}
    name_by_metric_id = {v: k for k, v in metric_id_by_name.items()}
    metric_type_by_id = {
        metric_id_by_name[metric.metric_name]: metric.type for metric in effective_metrics
    }
    weight_by_metric_id = {
        metric_id_by_name[metric.metric_name]: normalized_weights[metric.metric_name]
        for metric in effective_metrics
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
    dropped: List[DroppedTicker] = []
    requested_metric_ids = set(metric_id_by_name.values())

    for ticker, metrics_values in ticker_metric_values.items():
        available_metric_ids = set(metrics_values.keys())
        missing_metric_ids = requested_metric_ids - available_metric_ids

        # Handle missing_policy
        if payload.missing_policy == "drop":
            # Skip ticker if any metric is missing
            if missing_metric_ids:
                missing_names = [name_by_metric_id[mid] for mid in missing_metric_ids if mid in name_by_metric_id]
                dropped.append(
                    DroppedTicker(
                        ticker=ticker,
                        reason="Dropped due to missing metrics",
                        missing_metrics=missing_names or None,
                    )
                )
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

    if not ranking and payload.missing_policy != "drop":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ranking could be computed for the provided parameters.",
        )

    response = WSMScoreResponse(year=payload.year, ranking=ranking, dropped_tickers=dropped)

    if user_id is not None:
        try:
            db.add(
                ScoringResult(
                    user_id=user_id,
                    template_id=None,
                    year=payload.year,
                    request=payload.model_dump(),
                    ranking=response.model_dump(),
                )
            )
            _safe_commit(db)
        except Exception:  # pylint: disable=broad-exception-caught
            db.rollback()

    return response


def _coverage_by_ticker(db: Session, year: int) -> Dict[str, CoverageSummary]:
    mapping_entries = load_metric_mapping_list()
    if not mapping_entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Metric mapping is empty.",
        )

    metric_names = [entry.metric_name for entry in mapping_entries]
    definitions = (
        db.query(MetricDefinition)
        .filter(MetricDefinition.metric_name.in_(metric_names))
        .filter(~MetricDefinition.metric_name.in_(DISABLED_METRICS))
        .all()
    )
    name_to_def = {d.metric_name: d for d in definitions}
    missing_defs = [name for name in metric_names if name not in name_to_def]
    if missing_defs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Metric definitions not found for: {', '.join(missing_defs)}",
        )

    metric_ids = [name_to_def[name].id for name in metric_names]
    rows = (
        db.query(Emiten.ticker_code, FinancialData.metric_id, FinancialData.value)
        .join(Emiten, FinancialData.emiten_id == Emiten.id)
        .filter(FinancialData.year == year)
        .filter(FinancialData.metric_id.in_(metric_ids))
        .all()
    )

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No financial data found for the requested year/metrics.",
        )

    coverage_used: Dict[str, int] = {}
    tickers: set[str] = set()
    for ticker, _metric_id, value in rows:
        tickers.add(ticker)
        if value is None:
            continue
        coverage_used[ticker] = coverage_used.get(ticker, 0) + 1

    total_metrics = len(metric_ids)
    coverage_by_ticker: Dict[str, CoverageSummary] = {}
    for ticker in tickers:
        used = coverage_used.get(ticker, 0)
        pct = used / total_metrics if total_metrics else 0.0
        coverage_by_ticker[ticker] = CoverageSummary(used=used, total=total_metrics, pct=round(pct, 6))

    return coverage_by_ticker


def calculate_wsm_score_preview(db: Session, payload: WSMScoreRequest, user_id: int | None = None) -> WSMScorePreviewResponse:
    base_result = calculate_wsm_score(db, payload, user_id=user_id)
    coverage_by = _coverage_by_ticker(db, payload.year)

    items: List[WSMRankingPreviewItem] = []
    total_metrics = next(iter(coverage_by.values())).total if coverage_by else 0

    for item in base_result.ranking:
        coverage = coverage_by.get(item.ticker) or CoverageSummary(used=0, total=total_metrics, pct=0.0)
        confidence = _compute_confidence_label(coverage.pct)
        items.append(
            WSMRankingPreviewItem(
                rank=0,
                ticker=item.ticker,
                score=item.score,
                coverage=coverage,
                confidence=confidence,  # type: ignore[arg-type]
            )
        )

    items.sort(key=lambda it: (-it.score, -it.coverage.pct, it.ticker))
    for idx, it in enumerate(items, start=1):
        it.rank = idx

    return WSMScorePreviewResponse(
        year=payload.year,
        missing_policy=payload.missing_policy,
        ranking=items,
        tie_breaker=[
            "total_score desc",
            "coverage pct desc",
            "ticker asc",
        ],
        dropped_tickers=base_result.dropped_tickers,
    )


# =============================================================================
# Scorecard
# =============================================================================


def compute_scorecard(db: Session, payload: ScorecardRequest, user_id: int | None = None) -> ScorecardResponse:
    mapping_entries, default_weight_raw, normalized_default_weights = _prepare_mapping_defaults()
    mapping_by_name = load_metric_mapping_dict()
    metric_names = [entry.metric_name for entry in mapping_entries]

    # Fetch metric definitions to resolve IDs
    definitions = (
        db.query(MetricDefinition)
        .filter(MetricDefinition.metric_name.in_(metric_names))
        .filter(~MetricDefinition.metric_name.in_(DISABLED_METRICS))
        .all()
    )
    name_to_def = {d.metric_name: d for d in definitions}
    missing_defs = [name for name in metric_names if name not in name_to_def]
    if missing_defs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Metric definitions not found for: {', '.join(missing_defs)}",
        )

    metric_id_by_name = {name: name_to_def[name].id for name in metric_names}
    name_by_id = {v: k for k, v in metric_id_by_name.items()}
    metric_type_by_name = {name: mapping_by_name[name].type for name in metric_names}

    weight_scope = payload.weight_scope
    weights_json = payload.weights_json
    if payload.weight_template_id is not None:
        template = _load_weight_template_owned(db, payload.weight_template_id, user_id)
        weight_scope = template.scope
        weights_json = template.weights_json

    effective_weights = _resolve_metric_weight_map(
        weight_scope,
        weights_json,
        mapping_entries,
        default_weight_raw,
        normalized_default_weights,
    )

    # Fetch all financial data for the given year across the requested metrics
    metric_ids = list(metric_id_by_name.values())
    rows = (
        db.query(Emiten.ticker_code, FinancialData.metric_id, FinancialData.value)
        .join(Emiten, FinancialData.emiten_id == Emiten.id)
        .filter(FinancialData.year == payload.year)
        .filter(FinancialData.metric_id.in_(metric_ids))
        .all()
    )

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No financial data found for the requested year/metrics.",
        )

    ticker_values: Dict[str, Dict[int, float]] = {}
    values_by_metric: Dict[int, List[float]] = {mid: [] for mid in metric_ids}

    for ticker, metric_id, value in rows:
        if value is None:
            continue
        metric_name = name_by_id.get(metric_id)
        if not metric_name:
            continue
        metric_type = metric_type_by_name.get(metric_name, "benefit")
        adjusted_value = float(abs(value)) if metric_type == "cost" and value < 0 else float(value)
        ticker_values.setdefault(ticker, {})[metric_id] = adjusted_value
        values_by_metric[metric_id].append(adjusted_value)

    if payload.ticker not in ticker_values:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticker {payload.ticker} has no data for year {payload.year}.",
        )

    max_by_metric: Dict[int, float] = {}
    min_by_metric: Dict[int, float] = {}
    for mid, vals in values_by_metric.items():
        if vals:
            max_by_metric[mid] = max(vals)
            min_by_metric[mid] = min(vals)

    requested_metric_ids = set(metric_ids)
    total_metrics = len(metric_ids)

    def compute_for_ticker(ticker: str, include_metrics: bool = False):
        metric_map = ticker_values.get(ticker, {})
        available_metric_ids = set(metric_map.keys())
        missing_metric_ids = requested_metric_ids - available_metric_ids

        if payload.missing_policy == "drop" and missing_metric_ids:
            missing_names = [name_by_id[mid] for mid in missing_metric_ids if mid in name_by_id]
            return None, missing_names

        if payload.missing_policy == "redistribute":
            available_weight_sum = sum(
                effective_weights.get(name_by_id[mid], 0) for mid in available_metric_ids
            )
            if available_weight_sum <= 0:
                return None, None
            weight_divisor = available_weight_sum
        else:
            weight_divisor = 1.0

        section_totals = {
            "balance": 0.0,
            "income": 0.0,
            "cash_flow": 0.0,
        }
        section_weight_shares = {
            "balance": 0.0,
            "income": 0.0,
            "cash_flow": 0.0,
        }

        used_count = 0
        total_score = 0.0
        metric_rows: List[ScorecardMetric] = []

        for entry in mapping_entries:
            metric_name = entry.metric_name
            metric_id = metric_id_by_name.get(metric_name)
            if metric_id is None:
                continue

            raw_value = metric_map.get(metric_id)
            normalized_value = 0.0
            contribution = 0.0
            is_missing = raw_value is None

            if raw_value is not None:
                used_count += 1
                if entry.type == "benefit":
                    denom = max_by_metric.get(metric_id, 0)
                    raw_norm = (raw_value / denom) if denom else 0.0
                    normalized_value = _clamp01(raw_norm)
                else:
                    num = min_by_metric.get(metric_id, 0)
                    if raw_value == 0 or num == 0:
                        normalized_value = 0.0
                    else:
                        raw_norm = num / raw_value
                        normalized_value = _clamp01(raw_norm)

                weight_share = effective_weights.get(metric_name, 0) / weight_divisor
                contribution = weight_share * normalized_value
            else:
                weight_share = 0.0 if payload.missing_policy == "redistribute" else effective_weights.get(metric_name, 0) / weight_divisor

            total_score += contribution
            section_key = _normalize_section_key(entry.section)
            if section_key in section_totals:
                section_totals[section_key] += contribution
                section_weight_shares[section_key] += weight_share

            if include_metrics:
                metric_rows.append(
                    ScorecardMetric(
                        metric_name=metric_name,
                        section=section_key if section_key in {"balance", "income", "cash_flow"} else "cash_flow",
                        type=entry.type,  # type: ignore[arg-type]
                        display_unit=entry.display_unit,
                        allow_negative=entry.allow_negative,
                        raw_value=raw_value,
                        normalized_value=normalized_value,
                        default_weight=normalized_default_weights.get(metric_name, 0.0),
                        effective_weight=weight_share,
                        contribution=contribution,
                        is_missing=is_missing,
                    )
                )

        coverage_pct = used_count / total_metrics if total_metrics else 0.0
        missing_names = [entry.metric_name for entry in mapping_entries if metric_map.get(metric_id_by_name[entry.metric_name]) is None]

        return {
            "total_score": round(total_score, 6),
            "coverage_used": used_count,
            "coverage_pct": coverage_pct,
            "missing": missing_names,
            "section_totals": section_totals,
            "section_weight_shares": section_weight_shares,
            "metrics": metric_rows,
        }, None

    # Compute rankings across all available tickers for the year
    ranking_data = []
    for ticker in ticker_values.keys():
        computed, _ = compute_for_ticker(ticker, include_metrics=False)
        if computed is None:
            continue
        ranking_data.append((ticker, computed))

    if not ranking_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tickers satisfied the missing_policy for the requested metrics.",
        )

    # Sort per tie-breaker rules
    def _sort_key(item):
        ticker, data = item
        section = data["section_totals"]
        return (
            -data["total_score"],
            -data["coverage_pct"],
            -section.get("balance", 0.0),
            -section.get("income", 0.0),
            -section.get("cash_flow", 0.0),
            ticker,
        )

    ranking_data.sort(key=_sort_key)

    # Compute rank for requested ticker
    scorecard_data, dropped_missing = compute_for_ticker(payload.ticker, include_metrics=True)
    if dropped_missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": f"Ticker {payload.ticker} is not eligible for missing_policy=drop",
                "missing_metrics": dropped_missing,
            },
        )
    if scorecard_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticker {payload.ticker} does not satisfy missing_policy={payload.missing_policy}.",
        )

    rank = next((idx + 1 for idx, (t, _) in enumerate(ranking_data) if t == payload.ticker), None)
    if rank is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticker {payload.ticker} not found in ranking after applying policy.",
        )

    coverage_pct = scorecard_data["coverage_pct"]
    if coverage_pct >= 0.90:
        confidence = "High"
    elif coverage_pct >= 0.75:
        confidence = "Medium"
    else:
        confidence = "Low"

    coverage = ScorecardCoverage(
        used=scorecard_data["coverage_used"],
        total=total_metrics,
        pct=round(coverage_pct, 6),
        missing=scorecard_data["missing"],
    )

    section_totals = scorecard_data["section_totals"]
    section_weight_shares = scorecard_data.get("section_weight_shares", {})
    section_subtotals = ScorecardSectionSubtotals(
        balance=round(section_totals.get("balance", 0.0), 6),
        income=round(section_totals.get("income", 0.0), 6),
        cash_flow=round(section_totals.get("cash_flow", 0.0), 6),
    )

    section_breakdown = []
    for sec in ["balance", "income", "cash_flow"]:
        section_breakdown.append(
            {
                "section": sec,
                "score": round(section_totals.get(sec, 0.0), 6),
                "effective_weight_pct": round(section_weight_shares.get(sec, 0.0), 6),
            }
        )

    return ScorecardResponse(
        year=payload.year,
        ticker=payload.ticker,
        total_score=scorecard_data["total_score"],
        rank=rank,
        coverage=coverage,
        confidence=confidence,  # type: ignore[arg-type]
        section_breakdown=section_breakdown,  # type: ignore[arg-type]
        section_subtotals=section_subtotals,
        tie_breaker=[
            "total_score desc",
            "coverage pct desc",
            "balance subtotal desc",
            "income subtotal desc",
            "cash_flow subtotal desc",
            "ticker asc",
        ],
        metrics=scorecard_data["metrics"],
    )


# =============================================================================
# Simulation
# =============================================================================


def _get_section_metrics(db: Session, section: str) -> List[MetricWeightInput]:
    """Get all metrics for a section with their default weights."""
    metrics = (
        db.query(MetricDefinition)
        .filter(MetricDefinition.section == section)
        .filter(~MetricDefinition.metric_name.in_(DISABLED_METRICS))
        .order_by(MetricDefinition.metric_name)
        .all()
    )
    result = []
    for m in metrics:
        weight = getattr(m, "default_weight", None) or 1.0
        result.append(
            MetricWeightInput(
                metric_name=m.metric_name,
                type=m.type or "benefit",
                weight=float(weight),
            )
        )
    return result


def _get_overall_scope_metrics(db: Session) -> List[MetricWeightInput]:
    """DB-driven overall scope: enabled metrics with a positive default_weight."""
    metrics = (
        db.query(MetricDefinition)
        .filter(~MetricDefinition.metric_name.in_(DISABLED_METRICS))
        .filter(MetricDefinition.default_weight.isnot(None))
        .filter(MetricDefinition.default_weight > 0)
        .order_by(MetricDefinition.section, MetricDefinition.metric_name)
        .all()
    )

    result: List[MetricWeightInput] = []
    for m in metrics:
        result.append(
            MetricWeightInput(
                metric_name=m.metric_name,
                type=m.type or "benefit",
                weight=float(m.default_weight),
            )
        )

    return result


def _compute_single_ticker_score(
    db: Session,
    ticker: str,
    year: int,
    metrics: List[MetricWeightInput],
    missing_policy: str,
    overrides: Dict[str, float] | None = None,
    debug: Dict[str, float | int | bool] | None = None,
    with_reason: bool = False,
) -> float | tuple[float | None, str | None] | None:
    """
    Compute WSM score for a single ticker.
    If overrides is provided, apply them to metric values before scoring.
    Returns None if ticker has no data or is dropped by policy.
    """
    if not metrics:
        return (None, "No metrics provided") if with_reason else None

    # Get metric definitions
    metric_names = [m.metric_name for m in metrics]
    definitions = (
        db.query(MetricDefinition)
        .filter(MetricDefinition.metric_name.in_(metric_names))
        .all()
    )
    if not definitions:
        return (None, "Metric definitions not found") if with_reason else None

    # Build maps
    picked: Dict[str, MetricDefinition] = {}
    for name in metric_names:
        candidates = [d for d in definitions if d.metric_name == name]
        if candidates:
            picked[name] = candidates[0]

    if not picked:
        return (None, "Metric definitions not found") if with_reason else None

    metric_id_by_name = {name: d.id for name, d in picked.items()}
    metric_type_by_name = {m.metric_name: m.type for m in metrics}

    # Normalize weights
    total_weight = sum(m.weight for m in metrics)
    if total_weight <= 0:
        return (None, "Total weight must be > 0") if with_reason else None
    normalized_weights = {m.metric_name: m.weight / total_weight for m in metrics}
    if debug is not None:
        debug["requested_metric_count"] = len(metric_names)
        debug["total_weight"] = total_weight
        debug["normalization_year"] = year

    # Fetch all data for normalization (need min/max across all tickers)
    metric_ids = list(metric_id_by_name.values())
    all_rows = (
        db.query(Emiten.ticker_code, FinancialData.metric_id, FinancialData.value)
        .join(Emiten, FinancialData.emiten_id == Emiten.id)
        .filter(FinancialData.year == year, FinancialData.metric_id.in_(metric_ids))
        .all()
    )
    if not all_rows:
        return (None, "No financial data for ticker/year") if with_reason else None

    # Build min/max by metric
    values_by_metric: Dict[int, List[float]] = {mid: [] for mid in metric_ids}
    ticker_values: Dict[int, float] = {}
    name_by_id = {v: k for k, v in metric_id_by_name.items()}

    for t, mid, val in all_rows:
        if val is None:
            continue
        x = float(val)
        mtype = metric_type_by_name.get(name_by_id.get(mid, ""), "benefit")
        adjusted = abs(x) if mtype == "cost" and x < 0 else x
        values_by_metric[mid].append(adjusted)
        if t == ticker:
            ticker_values[mid] = adjusted

    # Apply overrides (only update ticker_values, not normalization range)
    if overrides:
        for metric_name, override_value in overrides.items():
            mid = metric_id_by_name.get(metric_name)
            if mid is not None:
                mtype = metric_type_by_name.get(metric_name, "benefit")
                adjusted = abs(override_value) if mtype == "cost" and override_value < 0 else override_value
                ticker_values[mid] = adjusted
                # NOTE: Do NOT add to values_by_metric - keep original min/max

    if not ticker_values:
        return (None, "No data for ticker") if with_reason else None

    # Compute min/max
    max_by_metric: Dict[int, float] = {}
    min_by_metric: Dict[int, float] = {}
    for mid, vals in values_by_metric.items():
        if vals:
            max_by_metric[mid] = max(vals)
            min_by_metric[mid] = min(vals)

    # Handle missing policy
    available_metric_ids = set(ticker_values.keys())
    requested_metric_ids = set(metric_ids)
    missing_metric_ids = requested_metric_ids - available_metric_ids

    if missing_policy == "drop" and missing_metric_ids:
        missing_names = [name_by_id[mid] for mid in missing_metric_ids if mid in name_by_id]
        return (None, f"Missing metrics: {', '.join(missing_names)}") if with_reason else None
    elif missing_policy == "redistribute":
        available_weight_sum = sum(
            normalized_weights[name_by_id[mid]]
            for mid in available_metric_ids
            if mid in name_by_id
        )
        if available_weight_sum <= 0:
            return (None, "No available weights after redistribution") if with_reason else None
        weight_divisor = available_weight_sum
        if debug is not None:
            debug["weights_renormalized"] = True
            debug["available_weight_sum"] = available_weight_sum
    else:  # zero
        weight_divisor = 1.0
        if debug is not None:
            debug["weights_renormalized"] = False

    if debug is not None:
        debug["metrics_used_count"] = len(available_metric_ids)

    # Compute score
    score = 0.0
    for mid in available_metric_ids:
        metric_name = name_by_id.get(mid)
        if not metric_name:
            continue
        mtype = metric_type_by_name.get(metric_name, "benefit")
        value = ticker_values[mid]

        if mtype == "benefit":
            denom = max_by_metric.get(mid, 0)
            raw = (value / denom) if denom else 0.0
            normalized_value = max(0.0, min(1.0, raw))
        else:
            num = min_by_metric.get(mid, 0)
            if value == 0 or num == 0:
                normalized_value = 0.0
            else:
                raw = num / value
                normalized_value = max(0.0, min(1.0, raw))

        weight_share = normalized_weights.get(metric_name, 0) / weight_divisor
        score += weight_share * normalized_value

    if debug is not None:
        total_weight_used = sum(
            normalized_weights.get(name_by_id[mid], 0) / weight_divisor
            for mid in available_metric_ids
        )
        debug["total_weight_used"] = total_weight_used

    result = round(score, 6)
    return (result, None) if with_reason else result


def _get_metric_raw_value(
    db: Session,
    ticker: str,
    year: int,
    metric_name: str,
    overrides: Dict[str, float] | None = None,
) -> float | None:
    """Get raw metric value for a ticker/year, applying optional override."""
    # Check if metric has an override
    if overrides and metric_name in overrides:
        # For overrides, we return the override value directly
        # (the backend multiplies by baseline to get the simulated value)
        return overrides[metric_name]

    # Otherwise, fetch from database
    metric_def = db.query(MetricDefinition).filter(MetricDefinition.metric_name == metric_name).first()
    if not metric_def:
        return None

    data = (
        db.query(FinancialData.value)
        .join(Emiten, FinancialData.emiten_id == Emiten.id)
        .filter(
            Emiten.ticker_code == ticker,
            FinancialData.metric_id == metric_def.id,
            FinancialData.year == year,
        )
        .first()
    )

    return float(data[0]) if data and data[0] is not None else None


def run_simulation(
    db: Session,
    payload: SimulationRequest,
    user_id: int | None = None,
    debug: bool = False,
) -> SimulationResponse:
    """Run simulation with metric overrides for a single ticker."""
    # Validate section requirement
    if payload.mode == "section" and not payload.section:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section is required when mode is 'section'.",
        )

    # Check ticker exists
    emiten = db.query(Emiten).filter(Emiten.ticker_code == payload.ticker).first()
    if not emiten:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ticker not found: {payload.ticker}",
        )

    # Validate overrides metric names exist (collect definitions for detail rows)
    override_names = [o.metric_name for o in payload.overrides] if payload.overrides else []
    metric_defs_for_overrides = {}
    if override_names:
        existing_defs = (
            db.query(MetricDefinition)
            .filter(MetricDefinition.metric_name.in_(override_names))
            .all()
        )
        metric_defs_for_overrides = {d.metric_name: d for d in existing_defs}

    # Resolve weights (default or template/custom) then derive metrics for mode
    mapping_entries, default_weight_raw, normalized_default_weights = _prepare_mapping_defaults()

    weight_scope = payload.weight_scope
    weights_json = payload.weights_json
    if payload.weight_template_id is not None:
        template = _load_weight_template_owned(db, payload.weight_template_id, user_id)
        weight_scope = template.scope
        weights_json = template.weights_json

    weight_map = _resolve_metric_weight_map(
        weight_scope,
        weights_json,
        mapping_entries,
        default_weight_raw,
        normalized_default_weights,
    )

    if payload.mode == "section":
        section_key = _normalize_section_key(payload.section)
        section_entries = [e for e in mapping_entries if _normalize_section_key(e.section) == section_key]
        if not section_entries:
            return SimulationResponse(
                ticker=payload.ticker,
                year=payload.year,
                mode=payload.mode,
                section=payload.section,
                message="No metrics available for the selected mode/section.",
            )
        section_weight_map = _normalize_weight_map(
            {e.metric_name: weight_map.get(e.metric_name, 0.0) for e in section_entries}
        )
        metrics = _metric_inputs_from_weight_map(section_entries, section_weight_map)
    else:
        metrics = _metric_inputs_from_weight_map(mapping_entries, weight_map)

    if not metrics:
        return SimulationResponse(
            ticker=payload.ticker,
            year=payload.year,
            mode=payload.mode,
            section=payload.section,
            message="No metrics available for the selected mode/section.",
        )

    # Filter applied overrides to only those in the metrics list
    metric_names_in_scope = {m.metric_name for m in metrics}
    effective_overrides = []
    ignored_overrides = []
    if payload.overrides:
        for o in payload.overrides:
            if o.metric_name in metric_names_in_scope:
                effective_overrides.append(o)
            else:
                ignored_overrides.append(o.metric_name)

    baseline_debug: Dict[str, float | int | bool] | None = {} if debug else None
    simulated_debug: Dict[str, float | int | bool] | None = {} if debug else None

    # Compute baseline score (without overrides)
    baseline_score = _compute_single_ticker_score(
        db,
        payload.ticker,
        payload.year,
        metrics,
        payload.missing_policy,
        overrides=None,
        debug=baseline_debug,
    )

    # Precompute baseline raw values for overrides to apply percentage deltas
    baseline_raw_cache: Dict[str, float | None] = {}
    overrides_dict = None
    if effective_overrides:
        overrides_dict = {}
        for o in effective_overrides:
            base_raw = baseline_raw_cache.get(o.metric_name)
            if base_raw is None and o.metric_name not in baseline_raw_cache:
                base_raw = _get_metric_raw_value(
                    db,
                    payload.ticker,
                    payload.year,
                    o.metric_name,
                    overrides=None,
                )
                baseline_raw_cache[o.metric_name] = base_raw

            if base_raw is None:
                continue

            overrides_dict[o.metric_name] = base_raw * (1.0 + o.value / 100.0)

    # Compute simulated score (with overrides as absolute values)
    simulated_score = _compute_single_ticker_score(
        db,
        payload.ticker,
        payload.year,
        metrics,
        payload.missing_policy,
        overrides=overrides_dict,
        debug=simulated_debug,
    )

    # Calculate delta
    delta = None
    if baseline_score is not None and simulated_score is not None:
        delta = round(simulated_score - baseline_score, 6)

    message = None
    if baseline_score is None:
        message = f"No baseline data for ticker {payload.ticker} in year {payload.year}."
    elif ignored_overrides:
        message = f"Ignored overrides not in {payload.section or 'overall'} scope: {', '.join(ignored_overrides)}"

    # Build adjustments_detail: one entry per requested override (preserve order)
    adjustments_detail: List[SimulationAdjustmentDetail] = []
    for override in payload.overrides or []:
        metric_name = override.metric_name
        adjustment_percent = override.value

        metric_def = metric_defs_for_overrides.get(metric_name)
        metric_section = metric_def.section if metric_def else None
        metric_type = None
        if metric_def is not None:
            metric_type = metric_def.type.value if hasattr(metric_def.type, "value") else metric_def.type

        in_scope = metric_name in metric_names_in_scope
        affects_score = in_scope and metric_def is not None

        reason = None
        unmatched_reason = None

        if metric_def is None:
            unmatched_reason = "Metric definition not found"
            affects_score = False
        elif not in_scope:
            unmatched_reason = f"Metric not in {payload.section or 'overall'} scope"
            affects_score = False

        baseline_val = None
        simulated_val = None
        if metric_def is not None:
            baseline_val = baseline_raw_cache.get(metric_name)
            if baseline_val is None and metric_name not in baseline_raw_cache:
                baseline_val = _get_metric_raw_value(db, payload.ticker, payload.year, metric_name, overrides=None)
                baseline_raw_cache[metric_name] = baseline_val

            if baseline_val is None:
                reason = "missing data"
            else:
                simulated_val = baseline_val * (1.0 + adjustment_percent / 100.0)

        adjustments_detail.append(
            SimulationAdjustmentDetail(
                metric_key=metric_name,
                metric_name=metric_name,
                section=metric_section,
                type=metric_type or ("benefit" if metric_def is not None else None),
                baseline_value=baseline_val,
                simulated_value=simulated_val,
                adjustment_percent=adjustment_percent,
                affects_score=affects_score,
                out_of_range=False,
                capped=False,
                ignored=False,
                reason=reason,
                unmatched_reason=unmatched_reason,
            )
        )

    debug_info = None
    if debug and simulated_debug is not None:
        normalization_scope = payload.section if payload.mode == "section" else "overall"
        debug_info = SimulationDebugInfo(
            metrics_used_count=int(simulated_debug.get("metrics_used_count", 0)),
            requested_metric_count=int(simulated_debug.get("requested_metric_count", 0)),
            total_weight_used=float(simulated_debug.get("total_weight_used", 0.0)),
            normalization_year=int(simulated_debug.get("normalization_year", payload.year)),
            normalization_scope=normalization_scope,
            weights_renormalized=bool(simulated_debug.get("weights_renormalized", False)),
        )

    response = SimulationResponse(
        ticker=payload.ticker,
        year=payload.year,
        mode=payload.mode,
        section=payload.section,
        baseline_score=baseline_score,
        simulated_score=simulated_score,
        delta=delta,
        applied_overrides=payload.overrides,
        adjustments_detail=adjustments_detail,
        message=message,
        debug=debug_info,
    )

    if user_id is not None:
        try:
            db.add(
                SimulationLog(
                    user_id=user_id,
                    request=payload.model_dump(),
                    response=response.model_dump(),
                )
            )
            _safe_commit(db)
        except Exception:  # pylint: disable=broad-exception-caught
            db.rollback()

    return response


# =============================================================================
# Compare
# =============================================================================


def run_compare(db: Session, payload: CompareRequest, user_id: int | None = None) -> CompareResponse:
    """Compare WSM scores for multiple tickers across a year range."""
    # Validate year range
    if payload.year_from > payload.year_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="year_from must be less than or equal to year_to.",
        )

    # Validate section requirement
    if payload.mode == "section" and not payload.section:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section is required when mode is 'section'.",
        )

    # Validate tickers exist
    existing_tickers = (
        db.query(Emiten.ticker_code)
        .filter(Emiten.ticker_code.in_(payload.tickers))
        .all()
    )
    existing_set = {t.ticker_code for t in existing_tickers}
    unknown = [t for t in payload.tickers if t not in existing_set]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown ticker(s): {', '.join(unknown)}",
        )

    # Resolve metrics/weights (template or custom overrides supported)
    mapping_entries, default_weight_raw, normalized_default_weights = _prepare_mapping_defaults()

    weight_scope = payload.weight_scope
    weights_json = payload.weights_json
    if payload.weight_template_id is not None:
        template = _load_weight_template_owned(db, payload.weight_template_id, user_id)
        weight_scope = template.scope
        weights_json = template.weights_json

    weight_map = _resolve_metric_weight_map(
        weight_scope,
        weights_json,
        mapping_entries,
        default_weight_raw,
        normalized_default_weights,
    )

    if payload.mode == "section":
        section_key = _normalize_section_key(payload.section)
        section_entries = [e for e in mapping_entries if _normalize_section_key(e.section) == section_key]
        if not section_entries:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No metrics available for the selected mode/section.",
            )
        section_weight_map = _normalize_weight_map(
            {e.metric_name: weight_map.get(e.metric_name, 0.0) for e in section_entries}
        )
        metrics = _metric_inputs_from_weight_map(section_entries, section_weight_map)
    else:
        metrics = _metric_inputs_from_weight_map(mapping_entries, weight_map)

    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No metrics available for the selected mode/section.",
        )

    # Build year list
    years = list(range(payload.year_from, payload.year_to + 1))

    # Compute scores for each ticker across all years
    series = []
    dropped: List[DroppedTicker] = []
    for ticker in payload.tickers:
        scores: List[float | None] = []
        missing_years = []
        drop_reason: str | None = None

        for year in years:
            if payload.missing_policy == "drop":
                score, drop_reason_raw = _compute_single_ticker_score(
                    db, ticker, year, metrics, payload.missing_policy, overrides=None, with_reason=True
                )
                if score is None:
                    drop_reason = drop_reason_raw or f"Ticker {ticker} missing required metrics for year {year}"
                    break
            else:
                score = _compute_single_ticker_score(
                    db, ticker, year, metrics, payload.missing_policy, overrides=None
                )

            scores.append(score)
            if score is None:
                missing_years.append(year)

        if drop_reason:
            scores = [None for _ in years]
            missing_years = list(years)
            dropped.append(DroppedTicker(ticker=ticker, reason=drop_reason, missing_metrics=None))
        elif len(scores) < len(years):
            scores.extend([None for _ in range(len(years) - len(scores))])

        series.append(TickerSeries(ticker=ticker, scores=scores, missing_years=missing_years))

    response = CompareResponse(years=years, series=series, dropped_tickers=dropped)

    if user_id is not None:
        try:
            db.add(
                Comparison(
                    user_id=user_id,
                    request=payload.model_dump(),
                    response=response.model_dump(),
                )
            )
            _safe_commit(db)
        except Exception:  # pylint: disable=broad-exception-caught
            db.rollback()

    return response


def get_metrics_catalog(db: Session) -> MetricsCatalog:
    """
    Get catalog of available sections, metrics, modes, and missing policy options.
    Used to populate UI dropdowns dynamically.
    """
    # Get all sections with their metrics
    sections_data = []
    for section_key in ["income", "balance", "cashflow"]:
        # Get metrics for this section
        metrics_query = (
            db.query(MetricDefinition)
            .filter(MetricDefinition.section == section_key)
            .filter(~MetricDefinition.metric_name.in_(DISABLED_METRICS))
            .all()
        )
        
        metrics_info = []
        for m in metrics_query:
            metrics_info.append(
                MetricInfo(
                    key=m.metric_name,
                    label=m.metric_name,  # Use metric name as label
                    description=m.description or "",
                    type=(m.type.value if hasattr(m.type, "value") else m.type) or "benefit",
                    default_weight=float(m.default_weight) if getattr(m, "default_weight", None) is not None else None,
                )
            )
        
        # Section labels
        section_labels = {
            "income": "Income Statement",
            "balance": "Balance Sheet",
            "cashflow": "Cash Flow"
        }
        
        sections_data.append(
            SectionInfo(
                key=section_key,
                label=section_labels.get(section_key, section_key.title()),
                description=f"Metrics from the {section_labels.get(section_key, section_key)} section.",
                metrics=metrics_info
            )
        )
    
    # Missing policy options
    missing_policies = [
        MissingPolicyOption(
            key="zero",
            label="Zero (default)",
            description="Treat missing metric values as 0 in normalization."
        ),
        MissingPolicyOption(
            key="redistribute",
            label="Redistribute",
            description="Redistribute weights among available metrics."
        ),
        MissingPolicyOption(
            key="drop",
            label="Drop",
            description="Exclude ticker if any metric is missing."
        )
    ]
    
    # Mode options
    modes = [
        ModeOption(
            key="overall",
            label="Overall Score",
            description="Use default overall metrics (ROA, ROE, Operating Expense)."
        ),
        ModeOption(
            key="section",
            label="Section Ranking",
            description="Use all metrics from a specific section."
        )
    ]
    
    return MetricsCatalog(
        sections=sections_data,
        missing_policy_options=missing_policies,
        modes=modes
    )

