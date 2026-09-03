import pandas as pd

df = pd.read_csv('data/processed/2024.csv')
sample_emitens = df.columns[3:].tolist()
target_emitens = ['BBCA', 'BBRI', 'BMRI', 'BBNI']

# identify exact metric names
aset_m = [m for m in df['Metric'] if 'Total Aset' in str(m)][0]
laba_m = [m for m in df['Metric'] if 'Laba Bersih' in str(m)][0]
beban_m = [m for m in df['Metric'] if 'Beban Usaha' in str(m)][0]

metrics_info = {
    aset_m: 'Benefit',
    laba_m: 'Benefit',
    beban_m: 'Cost'
}

num_metrics = 39
weight = 1.0 / num_metrics

table1 = []

for m_name, m_type in metrics_info.items():
    row = df[df['Metric'] == m_name].iloc[0]
    vals = [float(row[e]) if pd.notna(row[e]) else 0.0 for e in sample_emitens]
    vmin = min(vals)
    vmax = max(vals)
    
    for e in target_emitens:
        val = float(row[e]) if pd.notna(row[e]) else 0.0
        
        if vmax == vmin:
            norm = 0.0
        else:
            if m_type == 'Benefit':
                norm = (val - vmin) / (vmax - vmin)
            else:
                norm = (vmax - val) / (vmax - vmin)
                
        weighted = norm * weight
        table1.append({
            'Emiten': e,
            'Metrik': m_name,
            'Raw': val,
            'Norm': norm,
            'Weight': weight,
            'Weighted': weighted
        })

print("=== TABEL 1 ===")
for r in table1:
    print(f"| {r['Emiten']} | {r['Metrik']} | {r['Raw']:,.2f} | {r['Norm']:.6f} | {r['Weight']:.6f} | {r['Weighted']:.6f} |")

print("\n=== TABEL 2 ===")
# We already have the scores from true_delta_targets.py:
# BBCA: 0.587826758
# BBRI: 0.658299573
# BMRI: 0.686654264
# BBNI: 0.441579137
# But wait, true_delta_targets assumed all were Benefit!! Did the actual data have Cost?
