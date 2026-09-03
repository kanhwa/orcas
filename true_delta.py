import pandas as pd
from decimal import Decimal, getcontext
import numpy as np

# Set precision for 'manual math' simulation
getcontext().prec = 50

# Load data of 2024
df = pd.read_csv('data/processed/2024.csv')
emitens = df.columns[3:]

# To make it a realistic sample, let's take BBCA, BBRI, BMRI, BBNI (Top 4)
sample_emitens = ['BBCA', 'BBRI', 'BMRI', 'BBNI']

# Filter data
metrics = df['Metric'].values
data_dict = {}

num_metrics = 39 # exclude 1
total_weight = Decimal('39')

python_scores = {e: 0.0 for e in sample_emitens}
manual_scores = {e: Decimal('0') for e in sample_emitens}

diffs = []

for idx, row in df.iterrows():
    m_name = row['Metric']
    if idx >= 39: continue # limit to 39
    
    # Extract values for these 4 banks
    vals = []
    for e in sample_emitens:
        v = row[e]
        vals.append(float(v) if pd.notna(v) else 0.0)
    
    vmin = min(vals)
    vmax = max(vals)
    
    vmin_dec = Decimal(str(vmin))
    vmax_dec = Decimal(str(vmax))
    
    # Assume all benefit just for checking mathematical float delta
    for i, e in enumerate(sample_emitens):
        val = vals[i]
        val_dec = Decimal(str(val))
        
        if vmax == vmin:
            py_norm = 0.0
            man_norm = Decimal('0')
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

print("Volume Sample:", sample_emitens, "Year 2024")
print("Total float delta occurrences:", len(diffs))
if diffs:
    for e, m, d in diffs[:5]:
        print(f"Emiten: {e}, Metric: {m}, Delta: {d:.20f}")

# Check final score delta
print("\nFinal Delta:")
for e in sample_emitens:
    fin_delta = abs(Decimal(str(python_scores[e])) - manual_scores[e])
    print(f"{e} - Py: {python_scores[e]:.16f}, Man: {float(manual_scores[e]):.16f}, Delta: {fin_delta:.20f}")
