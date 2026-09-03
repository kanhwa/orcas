from app.db.session import SessionLocal
from app.schemas.wsm import SimulationRequest
from app.services.wsm_service import run_simulation
from app.services.metric_mapping_loader import load_metric_mapping_list

with SessionLocal() as db:
    metrics = load_metric_mapping_list()
    equal_weights = {m.metric_name: 1.0 for m in metrics}
    
    payload = SimulationRequest(
        year=2024,
        ticker='BBRI', # doesn't matter for overall
        mode='overall',
        missing_policy='zero',
        weight_scope='metric',
        weights_json=equal_weights
    )
    
    resp = run_simulation(db, payload, user_id=None)
    
    print("\n=== TABEL 4.4 (TRUE EQUAL SCORES) ===")
    targets = ['BBCA', 'BBRI', 'BMRI', 'BBNI']
    
    for r in resp.rankings:
        if r.ticker in targets:
            print(f"| {r.ticker} | {r.score:.6f} |")
