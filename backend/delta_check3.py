import math
from app.db.session import SessionLocal
from app.models import Emiten, FinancialData, MetricDefinition
from app.schemas.wsm import SimulationRequest
from app.services.wsm_service import run_simulation

YEAR = 2024
db = SessionLocal()

req = SimulationRequest(ticker="BBCA", year=YEAR, mode="overall", missing_policy="zero")
resp = run_simulation(db, req, user_id=None)
system_rank = {r.ticker: r.score for r in resp.ranking}

all_metrics = db.query(MetricDefinition).filter(MetricDefinition.is_active==True).all()
emitens = db.query(Emiten).all()

data_matrix = {e.id: {m.id: 0.0 for m in all_metrics} for e in emitens}
q = db.query(FinancialData).filter(FinancialData.year == YEAR).all()
for d in q:
    data_matrix[d.emiten_id][d.metric_id] = float(d.value) if d.value else 0.0

total_weight = sum([float(m.default_weight) for m in all_metrics])
manual_rank = {e.ticker_code: 0.0 for e in emitens}

for m in all_metrics:
    vals = [data_matrix[e.id][m.id] for e in emitens]
    vmin, vmax = min(vals), max(vals)
    weight = float(m.default_weight) / total_weight
    
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

print(f"Sample Volume: {len(emitens)} emiten (Pada Tahun {YEAR})")
perfect = 0
diffs = {}
max_delta = 0

for t in system_rank:
    sys_val = system_rank[t]
    man_val = manual_rank[t]
    delta = abs(sys_val - man_val)
    if delta > max_delta: max_delta = delta
    if delta < 1e-15:
        perfect += 1
    else:
        diffs[t] = delta

print(f"100% presisi (delta = 0.0): {perfect} emiten")
print(f"Max delta floating point: {max_delta}")
if diffs:
    print(f"Jumlah yang deviasi floating point: {len(diffs)}")
    print(f"Contoh deviasi:")
    for k,v in list(diffs.items())[:3]:
        print(f"  {k} -> system: {system_rank[k]:.16f}, manual: {manual_rank[k]:.16f}, delta: {v:.16e}")

