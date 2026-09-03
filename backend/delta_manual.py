import json
from decimal import Decimal
import pandas as pd
from app.db.session import SessionLocal
from app.models import Emiten, FinancialData, MetricDefinition
from app.schemas.wsm import SimulationRequest
from app.services.wsm_service import run_simulation

YEAR = 2024
db = SessionLocal()

# 1. RUN SYSTEM SIMULATION
req = SimulationRequest(
    ticker="BBCA", # The ticker doesn't matter for the overall ranking table output
    year=YEAR,
    mode="overall",
    missing_policy="zero" # Or whatever default is
)
resp = run_simulation(db, req, user_id=None)
system_rank = {r.ticker: r.score for r in resp.ranking}

# 2. RUN MANUAL SIMULATION (Re-implement WSM exactly as WSM formula says)
data = {}
all_metrics = [m for m in db.query(MetricDefinition).all() if m.metric_name in resp.ranking[0].metric_scores]
emiten_ids = [e.id for e in db.query(Emiten).all() if e.ticker_code in system_rank]
emitens = {e.id: e.ticker_code for e in db.query(Emiten).all()}

for m in all_metrics:
    data[m.metric_name] = {}
    for eid in emiten_ids:
        val = db.query(FinancialData.value).filter_by(year=YEAR, emiten_id=eid, metric_id=m.id).scalar()
        data[m.metric_name][eid] = val if val is not None else 0.0

manual_rank = {eid: 0.0 for eid in emiten_ids}

deltas = {}

for m in all_metrics:
    # get min/max
    values = [float(v) for v in data[m.metric_name].values()]
    vmin, vmax = min(values), max(values)
    
    for eid in emiten_ids:
        val = float(data[m.metric_name][eid])
        if vmax == vmin:
            norm = 1.0 # Or 0 depending on logic, let's assume system does 1.0 or 0
            # Wait, let's see how system_service does it.
            # Usually norm = 0 if max==min in this codebase?
        else:
            if m.metric_type.value == 'cost':
                norm = (vmax - val) / (vmax - vmin)
            else:
                norm = (val - vmin) / (vmax - vmin)
        
        # We need default weights. If 39 metrics, weight is 1/39 for each.
        # Let's read from resp what score they gave
        pass

# Actually, the system's "Adjustments detail" tells us exactly what normalizations it got. 
# We can just check the python floating point differences.

print(f"Sample Volume: {len(system_rank)} emiten in Year {YEAR}")
