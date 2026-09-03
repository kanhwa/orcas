import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

file_path = "data/raw/DATASET BANKING [IDX].xlsx"
xls = pd.ExcelFile(file_path)
years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
data_aset, data_roa = [], []

def parse_num(v):
    if pd.isna(v): return np.nan
    if isinstance(v, (int, float)): return float(v)
    v = str(v).strip().replace(',', '')
    is_neg = False
    if '(' in v and ')' in v:
        is_neg = True
        v = v.replace('(', '').replace(')', '')
    for cl in [' B', ' T', '%']: v = v.replace(cl, '')
    try: return -float(v) if is_neg else float(v)
    except: return np.nan

for sheet in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet)
    aset_mask = df['Financial Metrics'].astype(str).str.contains('Total Aset', na=False, case=False)
    roa_mask = df['Financial Metrics'].astype(str).str.contains('ROA', na=False, case=False)
    for yr in years:
        if yr not in df.columns: continue
        if aset_mask.any():
            a_val = parse_num(df[aset_mask].iloc[0][yr])
            if not pd.isna(a_val): data_aset.append({'Total Aset': a_val})
        if roa_mask.any():
            r_val = parse_num(df[roa_mask].iloc[0][yr])
            if not pd.isna(r_val): data_roa.append({'ROA': r_val * 100})

df_aset, df_roa = pd.DataFrame(data_aset), pd.DataFrame(data_roa)

# 1. Gambar Aset
plt.figure(figsize=(8, 6))
sns.boxplot(y='Total Aset', data=df_aset, color='skyblue')
plt.title('Distribusi Total Aset (2015-2024)')
plt.ylabel('Rupiah (Miliar)')
plt.tight_layout()
plt.savefig('boxplot_aset.png', dpi=300)
plt.close()

# 2. Gambar ROA
plt.figure(figsize=(8, 6))
sns.boxplot(y='ROA', data=df_roa, color='lightgreen')
plt.title('Distribusi Return on Assets (2015-2024)')
plt.ylabel('ROA (%)')
plt.tight_layout()
plt.savefig('boxplot_roa.png', dpi=300)
plt.close()

print("Berhasil menyimpan gambar terpisah: boxplot_aset.png dan boxplot_roa.png")
