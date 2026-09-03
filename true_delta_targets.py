import pandas as pd
from decimal import Decimal, getcontext

getcontext().prec = 50
df = pd.read_csv('data/processed/2024.csv')
sample_emitens = df.columns[3:].tolist()
target_emitens = ['BBCA', 'BBRI', 'BMRI', 'BBNI']

num_metrics = 39
total_weight = Decimal('39')

python_scores = {e: 0.0 for e in target_emitens}
manual_scores = {e: Decimal('0') for e in target_emitens}

for idx, row in df.iterrows():
    if idx >= 39: continue
    vals = [float(row[e]) if pd.notna(row[e]) else 0.0 for e in sample_emitens]
    vmin = min(vals)
    vmax = max(vals)
    vmin_dec, vmax_dec = Decimal(str(vmin)), Decimal(str(vmax))
    
    for e in target_emitens:
        val = float(row[e]) if pd.notna(row[e]) else 0.0
        val_dec = Decimal(str(val))
        
        if vmax == vmin:
            py_norm, man_norm = 0.0, Decimal('0')
        else:
            py_norm = (val - vmin) / (vmax - vmin)
            man_norm = (val_dec - vmin_dec) / (vmax_dec - vmin_dec)
            
        py_weighted = py_norm * (1.0 / num_metrics)
        man_weighted = man_norm * (Decimal('1') / total_weight)
        
        python_scores[e] += py_weighted
        manual_scores[e] += man_weighted

for e in target_emitens:
    py_score = python_scores[e]
    man_score = manual_scores[e]
    delta = abs(Decimal(str(py_score)) - man_score)
    print(f"{e}:")
    print(f"- Skor Manual (Decimal): {man_score:.25f}")
    print(f"- Skor Python (Float):   {py_score:.25f}")
    print(f"- Nilai Delta (Selisih): {delta:.25f}")
    print()