from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import DISABLED_METRICS
from app.models import Comparison, Emiten, FinancialData, MetricDefinition, ScoringResult, SimulationLog
from app.schemas.wsm import (
    CompareRequest,
    CompareResponse,
    MetricInfo,
    MetricsCatalog,
    MetricWeightInput,
    MissingPolicyOption,
    ModeOption,
    SectionInfo,
    SimulationRequest,
    SimulationResponse,
    TickerSeries,
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


def _safe_commit(db: Session) -> None:
    try:
        db.commit()
    except Exception:  # pylint: disable=broad-exception-caught
        db.rollback()


def calculate_wsm_score(db: Session, payload: WSMScoreRequest, user_id: int | None = None) -> WSMScoreResponse:
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

    response = WSMScoreResponse(year=payload.year, ranking=ranking)

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


# =============================================================================
# Simulation
# =============================================================================


def _get_section_metrics(db: Session, section: str) -> List[MetricWeightInput]:
    """Get all metrics for a section with their default weights."""
    metrics = (
        db.query(MetricDefinition)
        .filter(MetricDefinition.section == section)
        .filter(~MetricDefinition.metric_name.in_(DISABLED_METRICS))
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


def _get_overall_default_metrics() -> List[MetricWeightInput]:
    """Get default metrics for overall WSM mode."""
    return [
        MetricWeightInput(metric_name="Return on Assets (ROA)", type="benefit", weight=1.0),
        MetricWeightInput(metric_name="Return on Equity (ROE)", type="benefit", weight=1.0),
        MetricWeightInput(metric_name="Beban Usaha", type="cost", weight=1.0),
    ]


def _compute_single_ticker_score(
    db: Session,
    ticker: str,
    year: int,
    metrics: List[MetricWeightInput],
    missing_policy: str,
    overrides: Dict[str, float] | None = None,
) -> float | None:
    """
    Compute WSM score for a single ticker.
    If overrides is provided, apply them to metric values before scoring.
    Returns None if ticker has no data or is dropped by policy.
    """
    if not metrics:
        return None

    # Get metric definitions
    metric_names = [m.metric_name for m in metrics]
    definitions = (
        db.query(MetricDefinition)
        .filter(MetricDefinition.metric_name.in_(metric_names))
        .all()
    )
    if not definitions:
        return None

    # Build maps
    picked: Dict[str, MetricDefinition] = {}
    for name in metric_names:
        candidates = [d for d in definitions if d.metric_name == name]
        if candidates:
            picked[name] = candidates[0]

    if not picked:
        return None

    metric_id_by_name = {name: d.id for name, d in picked.items()}
    metric_type_by_name = {m.metric_name: m.type for m in metrics}

    # Normalize weights
    total_weight = sum(m.weight for m in metrics)
    if total_weight <= 0:
        return None
    normalized_weights = {m.metric_name: m.weight / total_weight for m in metrics}

    # Fetch all data for normalization (need min/max across all tickers)
    metric_ids = list(metric_id_by_name.values())
    all_rows = (
        db.query(Emiten.ticker_code, FinancialData.metric_id, FinancialData.value)
        .join(Emiten, FinancialData.emiten_id == Emiten.id)
        .filter(FinancialData.year == year, FinancialData.metric_id.in_(metric_ids))
        .all()
    )
    if not all_rows:
        return None

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
        return None

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
        return None
    elif missing_policy == "redistribute":
        available_weight_sum = sum(
            normalized_weights[name_by_id[mid]]
            for mid in available_metric_ids
            if mid in name_by_id
        )
        if available_weight_sum <= 0:
            return None
        weight_divisor = available_weight_sum
    else:  # zero
        weight_divisor = 1.0

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

    return round(score, 6)


def run_simulation(db: Session, payload: SimulationRequest, user_id: int | None = None) -> SimulationResponse:
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

    # Validate overrides metric names exist
    if payload.overrides:
        override_names = [o.metric_name for o in payload.overrides]
        existing = (
            db.query(MetricDefinition.metric_name)
            .filter(MetricDefinition.metric_name.in_(override_names))
            .all()
        )
        existing_names = {r.metric_name for r in existing}
        unknown = [n for n in override_names if n not in existing_names]
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown metric(s): {', '.join(unknown[:5])}",
            )

    # Get metrics based on mode
    if payload.mode == "section":
        metrics = _get_section_metrics(db, payload.section)
    else:
        metrics = _get_overall_default_metrics()

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

    # Compute baseline score (without overrides)
    baseline_score = _compute_single_ticker_score(
        db, payload.ticker, payload.year, metrics, payload.missing_policy, overrides=None
    )

    # Compute simulated score (with overrides)
    overrides_dict = {o.metric_name: o.value for o in effective_overrides} if effective_overrides else None
    simulated_score = _compute_single_ticker_score(
        db, payload.ticker, payload.year, metrics, payload.missing_policy, overrides=overrides_dict
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

    response = SimulationResponse(
        ticker=payload.ticker,
        year=payload.year,
        mode=payload.mode,
        section=payload.section,
        baseline_score=baseline_score,
        simulated_score=simulated_score,
        delta=delta,
        applied_overrides=effective_overrides,
        message=message,
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

    # Get metrics based on mode
    if payload.mode == "section":
        metrics = _get_section_metrics(db, payload.section)
    else:
        metrics = _get_overall_default_metrics()

    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No metrics available for the selected mode/section.",
        )

    # Build year list
    years = list(range(payload.year_from, payload.year_to + 1))

    # Compute scores for each ticker across all years
    series = []
    for ticker in payload.tickers:
        scores = []
        missing_years = []
        for year in years:
            score = _compute_single_ticker_score(
                db, ticker, year, metrics, payload.missing_policy, overrides=None
            )
            scores.append(score)
            if score is None:
                missing_years.append(year)
        series.append(TickerSeries(ticker=ticker, scores=scores, missing_years=missing_years))

    response = CompareResponse(years=years, series=series)

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
                    description=f"Type: {m.type or 'benefit'}, Weight: {getattr(m, 'default_weight', 1.0)}"
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

