from app.db.session import SessionLocal
from app.models import Emiten, FinancialData, MetricDefinition
from app.schemas.wsm import SimulationRequest
from app.services.wsm_service import run_simulation
from decimal import Decimal

with SessionLocal() as db:
    # Get all metric definitions to map cost/benefit
    metrics = db.query(MetricDefinition).all()
    cost_metrics = [m.metric_name for m in metrics if m.is_cost]
    benefit_metrics = [m.metric_name for m in metrics if not m.is_cost]
    
    payload = SimulationRequest(
        year=2024,
        mode='overall',
        overrides=[],
        missing_policy='zero'
    )
    resp = run_simulation(db, payload, user_id=None)
    
    print("\n=== TABEL 2: SKOR KOMPOSIT FINAL ===")
    targets = ['BBCA', 'BBRI', 'BMRI', 'BBNI']
    
    for r in resp.rankings:
        if r.ticker in targets:
            print(f"| {r.ticker} | {r.score:.6f} |")

