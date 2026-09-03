import pandas as pd
from decimal import Decimal, getcontext
import numpy as np

getcontext().prec = 50

df = pd.read_csv('data/processed/2024.csv')
sample_emitens = df.columns[3:].tolist()

num_metrics = 39
total_weight = Decimal('39')

python_scores = {e: 0.0 for e in sample_emitens}
manual_scores = {e: Decimal('0') for e in sample_emitens}

diffs = []
for idx, row in df.iterrows():
    m_name = row['Metric']
    if idx >= 39: continue
    
    vals = []
    for e in sample_emitens:
        v = row[e]
        vals.append(float(v) if pd.notna(v) else 0.0)
    
    vmin = min(vals)
    vmax = max(vals)
    vmin_dec = Decimal(str(vmin))
    vmax_dec = Decimal(str(vmax))
    
    for i, e in enumerate(sample_emitens):
        val = vals[i]
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
        
        delta = abs(Decimal(str(py_weighted)) - man_weighted)
        if delta > Decimal('1e-15'):
            diffs.append((e, m_name, delta))

print("Volume Sample:", len(sample_emitens), "emiten, Year 2024")

perfect_emiten = 0
max_delta_emiten = ("None", Decimal('0'))

for e in sample_emitens:
    fin_delta = abs(Decimal(str(python_scores[e])) - manual_scores[e])
    if fin_delta == Decimal('0'):
        perfect_emiten += 1
    if fin_delta > max_delta_emiten[1]:
        max_delta_emiten = (e, fin_delta)

print(f"Total emiten 100% presisi (delta mutlak 0.000...): {perfect_emiten}")
print(f"Max Delta: {max_delta_emiten[0]} dengan delta {max_delta_emiten[1]:.25f}")
