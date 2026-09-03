from app.db.session import SessionLocal
from app.schemas.wsm import ScorecardRequest
from app.services.wsm_service import compute_scorecard
from app.services.metric_mapping_loader import load_metric_mapping_list

with SessionLocal() as db:
    payload_bbca = ScorecardRequest(year=2024, ticker='BBCA', missing_policy='zero')
    scorecard_bbca = compute_scorecard(db, payload_bbca)
    
    payload_bbri = ScorecardRequest(year=2024, ticker='BBRI', missing_policy='zero')
    scorecard_bbri = compute_scorecard(db, payload_bbri)
    
    payload_bmri = ScorecardRequest(year=2024, ticker='BMRI', missing_policy='zero')
    scorecard_bmri = compute_scorecard(db, payload_bmri)

    payload_bbni = ScorecardRequest(year=2024, ticker='BBNI', missing_policy='zero')
    scorecard_bbni = compute_scorecard(db, payload_bbni)
    
    targets = {'BBCA': scorecard_bbca, 'BBRI': scorecard_bbri, 'BMRI': scorecard_bmri, 'BBNI': scorecard_bbni}
    
    for metric_name in ['Total Aset', 'Laba Bersih Tahun Berjalan', 'Beban Usaha']:
        print(f"--- {metric_name} ---")
        for t, sc in targets.items():
            for m in sc.metrics:
                if m.metric_name == metric_name:
                    print(f"{t} | Raw: {m.raw_value} | Norm: {m.normalized_value:.6f} | W: {m.effective_weight:.6f} | W_val: {m.contribution:.6f}")

    print("\n--- FINAL SCORES ---")
    for t, sc in targets.items():
        print(f"{t}: {sc.total_score:.6f}")

