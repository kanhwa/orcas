import math
from app.db.session import SessionLocal
from app.models import Emiten, FinancialData, MetricDefinition
from app.schemas.wsm import SimulationRequest
from app.services.wsm_service import run_simulation

YEAR = 2024
db = SessionLocal()

# 1. System WSM
req = SimulationRequest(ticker="BBCA", year=YEAR, mode="overall", missing_policy="zero")
resp = run_simulation(db, req, user_id=None)
system_rank = {r.ticker: r.score for r in resp.ranking}

# 2. Manual WSM Calculation
all_metrics = db.query(MetricDefinition).filter(MetricDefinition.is_active==True).all()
metric_map = {m.id: m for m in all_metrics}

emitens = db.query(Emiten).all()
emiten_map = {e.id: e.ticker_code for e in emitens}

# Collect Data
data_matrix = {e.id: {m.id: 0.0 for m in all_metrics} for e in emitens}
q = db.query(FinancialData).filter(FinancialData.year == YEAR).all()
for d in q:
    data_matrix[d.emiten_id][d.metric_id] = float(d.value) if d.value else 0.0

# 39 metrics equal weight 
weight = 1.0 / len(all_metrics)

manual_rank = {e.ticker_code: 0.0 for e in emitens}

for m in all_metrics:
    vals = [data_matrix[e.id][m.id] for e in emitens]
    vmin, vmax = min(vals), max(vals)
    
    for e in emitens:
        v = data_matrix[e.id][m.id]
        if vmax == vmin:
            norm = 0.0
        else:
            if m.type.value == 'cost':
                norm = (vmax - v) / (vmax - vmin)
            else:
                norm = (v - vmin) / (vmax - vmin)
        
        manual_rank[e.ticker_code] += norm * weight

# Compare
print(f"Sample Volume: {len(emitens)} emiten (Tahun {YEAR})")
diffs = {}
perfect_matches = 0
for t in system_rank:
    sys_val = system_rank[t]
    man_val = manual_rank[t]
    delta = abs(sys_val - man_val)
    if delta < 1e-15:  # consider 0.0
        perfect_matches += 1
    else:
        diffs[t] = delta

print(f"100% presisi (delta=0.0): {perfect_matches} emiten")
if diffs:
    print("Ada selisih presisi mengambang (floating point):")
    for k, v in list(diffs.items())[:5]:
        print(f"{k}: delta {v}")
