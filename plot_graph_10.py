import matplotlib.pyplot as plt
import matplotlib.cm as cm
from app.db.session import SessionLocal
from app.schemas.wsm import WSMScoreRequest
from app.services.wsm_service import calculate_wsm_score

target_emitens = ['BBRI', 'BMRI', 'BBCA', 'BBNI', 'BTPN', 'NOBU', 'BBKP', 'AGRS', 'BKSW', 'ARTO']
years = list(range(2015, 2025))

all_scores = {e: [] for e in target_emitens}

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

plt.figure(figsize=(14, 7))
markers = ['o', 's', '^', 'D', 'v', 'p', '*', 'h', 'H', 'x']
colors = cm.get_cmap('tab10').colors

for idx, e in enumerate(target_emitens):
    plt.plot(years, all_scores[e], marker=markers[idx], color=colors[idx], label=e, linewidth=2, markersize=6)

plt.title('Tren Skor Komposit WSM: Klasemen Atas vs Papan Bawah (2015-2024)', pad=15)
plt.xlabel('Tahun')
plt.ylabel('Skor Komposit WSM')
plt.xticks(years)
plt.ylim(0.1, 0.9)
plt.grid(axis='y', linestyle='--', alpha=0.7)
plt.legend(title='Emiten', bbox_to_anchor=(1.05, 1), loc='upper left')
plt.tight_layout()
plt.savefig('/Users/komings/Downloads/orcas/Gambar_4_5_10Bank.png', dpi=300)
print("10 Bank Graph saved successfully!")
