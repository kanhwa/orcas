from app.db.session import SessionLocal
from app.schemas.wsm import ScorecardRequest
from app.services.wsm_service import compute_scorecard
from app.services.metric_mapping_loader import load_metric_mapping_list

with SessionLocal() as db:
    metrics = load_metric_mapping_list()
    equal_weights = {m.metric_name: 1.0 for m in metrics}
    
    payload = ScorecardRequest(
        year=2024,
        ticker='BBRI',
        missing_policy='zero',
        weight_scope='metric',
        weights_json=equal_weights
    )
    
    scorecard = compute_scorecard(db, payload, user_id=None)
    
    print('=== BBRI EQUAL WEIGHT BREAKDOWN ===')
    print('Total Score:', scorecard.total_score)
    for sec in scorecard.section_breakdown:
        print(f'{sec.section}: {sec.score:.6f} / {scorecard.total_score:.6f} = {(sec.score/scorecard.total_score)*100:.2f}%')

    payload_arto = ScorecardRequest(
        year=2024,
        ticker='ARTO',
        missing_policy='zero',
        weight_scope='metric',
        weights_json=equal_weights
    )
    scorecard_arto = compute_scorecard(db, payload_arto, user_id=None)
    print('\n=== ARTO EQUAL WEIGHT BREAKDOWN ===')
    print('Total Score:', scorecard_arto.total_score)
    for sec in scorecard_arto.section_breakdown:
        print(f'{sec.section}: {sec.score:.6f} / {scorecard_arto.total_score:.6f} = {(sec.score/scorecard_arto.total_score)*100:.2f}%')

