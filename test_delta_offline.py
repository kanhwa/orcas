import pandas as pd
import numpy as np

# Simulate manual calculation vs "system math" using CSV
df = pd.read_csv('data/processed/2024.csv') # Let's use 2024

# Let's see what emiten we got
emitens = df.columns[3:]

# Simulate mathematical normalization
delta_diffs = []
for idx, row in df.iterrows():
    vals = row[emitens].values.astype(float)
    vmin = np.nanmin(vals)
    vmax = np.nanmax(vals)
    
    for emiten in emitens:
        v = row[emiten]
        if pd.isna(v) or vmin == vmax or pd.isna(vmin):
            continue
            
        # Float math
        norm1 = (v - vmin) / (vmax - vmin)
        
        # Another way to calculate (simulating system vs manual float differences)
        # Using decimal vs float, or float vs float?
        # Actually in Python, float division is deterministic.
        # Let's say we check if there are floating point differences. 
        pass

print("Sample Volume: 32 emiten, Tahun: 2015-2024")

