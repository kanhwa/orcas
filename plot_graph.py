import pandas as pd
import matplotlib.pyplot as plt
from app.services.metric_mapping_loader import load_metric_mapping_list
import warnings
warnings.filterwarnings('ignore')

metrics = load_metric_mapping_list()
metric_dict = {m.metric_name: m.type for m in metrics}
weight = 1.0 / 39

target_emitens = ['BBRI', 'BMRI', 'BBCA', 'BBNI', 'NOBU', 'BKSW', 'ARTO']
years = list(range(2015, 2025))
all_scores = {e: [] for e in target_emitens}

for year in years:
    try:
        df = pd.read_csv(f'../data/processed/{year}.csv')
    except:
        for e in target_emitens: all_scores[e].append(None)
        continue
        
    sample_emitens = df.columns[3:].tolist()
    final_scores = {e: 0.0 for e in sample_emitens}
    
    for m_name, m_type in metric_dict.items():
        if m_name not in df['Metric'].values: continue
        row = df[df['Metric'] == m_name].iloc[0]
        
        if m_type == 'cost':
            vals = [abs(float(row[e])) if pd.notna(row[e]) and float(row[e]) < 0 else float(row[e]) if pd.notna(row[e]) else 0.0 for e in sample_emitens]
        else:
            vals = [float(row[e]) if pd.notna(row[e]) else 0.0 for e in sample_emitens]
            
        vmin = min(vals)
        vmax = max(vals)
        
        for e in sample_emitens:
            raw_val = float(row[e]) if pd.notna(row[e]) else 0.0
            val = abs(raw_val) if m_type == 'cost' and raw_val < 0 else raw_val
            if vmax == vmin:
                norm = 0.0
            else:
                if m_type == 'benefit': norm = (val - vmin) / (vmax - vmin)
                else: norm = (vmax - val) / (vmax - vmin)
            final_scores[e] += norm * weight
            
    for e in target_emitens:
        if e in final_scores:
            all_scores[e].append(final_scores[e])
        else:
            all_scores[e].append(None)

plt.figure(figsize=(12, 6))
markers = ['o', 's', '^', 'D', 'v', 'p', '*']
colors = ['#9467bd', '#8c564b', '#2ca02c', '#d62728', '#1f77b4', '#e377c2', '#ff7f0e']
# Map: BBRI: purple, BMRI: brown, BBCA: green, BBNI: red
# BINA(old blue)->NOBU: blue, BKSW: pink, ARTO: orange

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
print("Graph saved to /Users/komings/Downloads/orcas/Gambar_4_5_Baru.png")
