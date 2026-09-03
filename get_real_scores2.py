from app.db.session import SessionLocal
from app.schemas.wsm import WSMScoreRequest
from app.services.wsm_service import compute_ranking

with SessionLocal() as db:
    payload = WSMScoreRequest(year=2024, missing_policy='zero')
    resp = compute_ranking(db, payload)
    
    print("\n=== TABEL 4.4 (TRUE DEFAULT SCORES) ===")
    targets = ['BBCA', 'BBRI', 'BMRI', 'BBNI']
    
    for r in resp.ranking:
        if r.ticker in targets:
            print(f"| {r.ticker} | {r.score:.6f} |")
