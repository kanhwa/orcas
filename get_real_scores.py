from app.db.session import SessionLocal
from app.schemas.wsm import SimulationRequest
from app.services.wsm_service import run_simulation

with SessionLocal() as db:
    payload = SimulationRequest(
        year=2024,
        mode='overall',
        overrides=[],
        missing_policy='zero'
    )
    
    # Run the simulation. It will use default weights because weights_json is not passed/empty.
    resp = run_simulation(db, payload, user_id=None)
    
    print("\n=== TABEL 4.4 (TRUE DEFAULT SCORES) ===")
    targets = ['BBCA', 'BBRI', 'BMRI', 'BBNI']
    
    for r in resp.rankings:
        if r.ticker in targets:
            print(f"| {r.ticker} | {r.score:.6f} |")
