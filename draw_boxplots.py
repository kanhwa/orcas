import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

file_path = "data/raw/DATASET BANKING [IDX].xlsx"
xls = pd.ExcelFile(file_path)
years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
data_aset = []
data_roa = []

def parse_num(v):
    if pd.isna(v): return np.nan
    if isinstance(v, (int, float)): return float(v)
    v = str(v).strip().replace(',', '')
    is_neg = False
    if '(' in v and ')' in v:
        is_neg = True
        v = v.replace('(', '').replace(')', '')
    if 'B' in v or 'T' in v:
        v = v.replace(' B', '').replace(' T', '')
    if '%' in v:
        v = v.replace('%', '')
    try:
        return -float(v) if is_neg else float(v)
    except: return np.nan

for sheet in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet)
    aset_mask = df['Financial Metrics'].astype(str).str.contains('Total Aset', na=False, case=False)
    roa_mask = df['Financial Metrics'].astype(str).str.contains('ROA', na=False, case=False)
    
    for yr in years:
        if yr not in df.columns: continue
        if aset_mask.any():
            a_val = parse_num(df[aset_mask].iloc[0][yr])
            if not pd.isna(a_val): data_aset.append({'Tahun': str(yr), 'Total Aset': a_val})
        if roa_mask.any():
            r_val = parse_num(df[roa_mask].iloc[0][yr])
            if not pd.isna(r_val):
                # Turn decimal to percent point for ROA visualisation (e.g. 0.04 -> 4.0%)
                data_roa.append({'Tahun': str(yr), 'ROA': r_val * 100})

df_aset = pd.DataFrame(data_aset)
df_roa = pd.DataFrame(data_roa)

fig, axes = plt.subplots(1, 2, figsize=(14, 6))

sns.boxplot(y='Total Aset', data=df_aset, ax=axes[0], color='skyblue', showfliers=True)
axes[0].set_title('Distribusi Total Aset (2015-2024)')
axes[0].set_ylabel('Rupiah (Miliar)')

sns.boxplot(y='ROA', data=df_roa, ax=axes[1], color='lightgreen', showfliers=True)
axes[1].set_title('Distribusi Return on Assets (2015-2024)')
axes[1].set_ylabel('ROA (%)')

plt.tight_layout()
plt.savefig('boxplot_univariat.png', dpi=300)
print("Berhasil menyimpan grafik Boxplot ke file boxplot_univariat.png")
