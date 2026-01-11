from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models import Emiten, FinancialData, MetricDefinition, MetricSection, MetricType
from app.schemas.wsm import MetricOverride, SimulationRequest
from app.services.wsm_service import run_simulation


def _setup_session():
    @compiles(JSONB, "sqlite")
    def _compile_jsonb(element, compiler, **kw):  # type: ignore
        return "TEXT"

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _seed_sample_data(db):
    metric_a = MetricDefinition(
        metric_name="Metric A",
        display_name_en="Metric A",
        section=MetricSection.income,
        type=MetricType.benefit,
        default_weight=1.0,
    )
    metric_b = MetricDefinition(
        metric_name="Metric B",
        display_name_en="Metric B",
        section=MetricSection.income,
        type=MetricType.benefit,
        default_weight=1.0,
    )
    db.add_all([metric_a, metric_b])
    db.flush()

    emiten_test = Emiten(ticker_code="TEST")
    emiten_other = Emiten(ticker_code="OTHER")
    db.add_all([emiten_test, emiten_other])
    db.flush()

    rows = [
        FinancialData(emiten_id=emiten_test.id, metric_id=metric_a.id, year=2024, value=10),
        FinancialData(emiten_id=emiten_other.id, metric_id=metric_a.id, year=2024, value=20),
        FinancialData(emiten_id=emiten_test.id, metric_id=metric_b.id, year=2024, value=5),
        FinancialData(emiten_id=emiten_other.id, metric_id=metric_b.id, year=2024, value=10),
    ]
    db.add_all(rows)
    db.commit()


def test_zero_adjustment_preserves_score():
    db = _setup_session()
    _seed_sample_data(db)

    payload = SimulationRequest(
        ticker="TEST",
        year=2024,
        mode="overall",
        overrides=[MetricOverride(metric_name="Metric A", value=0.0)],
        missing_policy="zero",
    )

    resp = run_simulation(db, payload, user_id=None)

    assert resp.baseline_score is not None
    assert resp.simulated_score is not None
    assert abs(resp.simulated_score - resp.baseline_score) < 1e-9


def test_benefit_increase_does_not_decrease_score():
    db = _setup_session()
    _seed_sample_data(db)

    payload = SimulationRequest(
        ticker="TEST",
        year=2024,
        mode="overall",
        overrides=[
            MetricOverride(metric_name="Metric A", value=80.0),
            MetricOverride(metric_name="Metric B", value=90.0),
        ],
        missing_policy="zero",
    )

    resp = run_simulation(db, payload, user_id=None)

    assert resp.baseline_score is not None
    assert resp.simulated_score is not None
    assert resp.simulated_score + 1e-9 >= resp.baseline_score
