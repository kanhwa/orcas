import matplotlib.pyplot as plt
from app.db.session import SessionLocal
from app.schemas.wsm import ScorecardRequest
from app.services.wsm_service import compute_scorecard
from app.services.metric_mapping_loader import load_metric_mapping_list

target_emitens = ['BBRI', 'BMRI', 'BBCA', 'BBNI', 'NOBU', 'BKSW', 'ARTO']
years = list(range(2015, 2025))

all_scores = {e: [] for e in target_emitens}

with SessionLocal() as db:
    for year in years:
        try:
            # We can use any valid ticker to get the scorecard, then extract all rankings?
            # compute_scorecard only returns the score for ONE ticker!
            pass
        except Exception as e:
            pass

# Wait, compute_scorecard only returns the scorecard for ONE ticker.
# To get ALL tickers' final scores efficiently, we should use calculate_wsm_score!
from app.schemas.wsm import WSMScoreRequest
from app.services.wsm_service import calculate_wsm_score

with SessionLocal() as db:
    for year in years:
        req = WSMScoreRequest(year=year, missing_policy='zero')
        try:
            res = calculate_wsm_score(db, req)
            scores_by_ticker = {item.ticker: item.score for item in res.ranking}
            for e in target_emitens:
                all_scores[e].append(scores_by_ticker.get(e, None))
        except Exception as e:
            for e in target_emitens:
                all_scores[e].append(None)

plt.figure(figsize=(12, 6))
markers = ['o', 's', '^', 'D', 'v', 'p', '*']
colors = ['#9467bd', '#8c564b', '#2ca02c', '#d62728', '#1f77b4', '#e377c2', '#ff7f0e']

for idx, e in enumerate(target_emitens):
    plt.plot(years, all_scores[e], marker=markers[idx], color=colors[idx], label=e, linewidth=2, markersize=4)

plt.title('Tren Skor Komposit WSM: Kelompok KBMI 4 vs Kategori Papan Bawah (2015-2024)', pad=15)
plt.xlabel('Tahun')
plt.ylabel('Skor Komposit WSM')
plt.xticks(years)
plt.ylim(0.1, 0.9)
plt.grid(axis='y', linestyle='--', alpha=0.7)
plt.legend(title='Emiten', bbox_to_anchor=(1.05, 1), loc='upper left')
plt.tight_layout()
plt.savefig('/Users/komings/Downloads/orcas/Gambar_4_5_Baru.png', dpi=300)
print("Graph saved successfully!")
