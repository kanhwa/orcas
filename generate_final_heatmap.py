import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

file_path = "data/raw/DATASET BANKING [IDX].xlsx"
xls = pd.ExcelFile(file_path)
years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
all_data = []

def parse_num(v):
    if pd.isna(v): return np.nan
    v = str(v).strip().replace(',', '')
    is_neg = True if '(' in v and ')' in v else False
    for cl in ['(', ')', ' B', ' T', '%']: v = v.replace(cl, '')
    try: return -float(v) if is_neg else float(v)
    except: return np.nan

for sheet in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet)
    for yr in years:
        if yr not in df.columns: continue
        row_data = {'Emiten': sheet, 'Tahun': yr}
        for _, row in df.iterrows():
            m = str(row['Financial Metrics']).strip()
            if pd.isna(m) or m == 'nan': continue
            row_data[m] = parse_num(row[yr])
        all_data.append(row_data)

df_all = pd.DataFrame(all_data)

anchors = [
    'Total Aset', 'Total Liabilitas', 'Total Ekuitas',
    'Total Pendapatan', 'Beban Usaha', 'Laba Bersih Tahun Berjalan',
    'Arus Kas Dari Aktivitas Operasi', 'Free cash flow',
    'Return on Assets (ROA)', 'Return on Equity (ROE)', 'Price to Book Value (PBV)'
]

existing = [m for m in anchors if m in df_all.columns]
df_anchors = df_all[existing]
corr_matrix = df_anchors.corr()

# Mengatur tampilan Seaborn
plt.figure(figsize=(12, 10))
sns.set_theme(style="white")

# Membuat heatmap
ax = sns.heatmap(
    corr_matrix, 
    annot=True, 
    fmt=".2f", 
    cmap="coolwarm", # Biru (dingin/negatif) ke Merah (panas/positif)
    center=0,
    vmin=-1, vmax=1,
    square=True, 
    linewidths=.5, 
    cbar_kws={"shrink": .8},
    annot_kws={"size": 10, "weight": "bold"}
)

plt.title('Matriks Korelasi Multivariat (11 Metrik Finansial)', fontsize=16, fontweight='bold', pad=20)
plt.xticks(rotation=45, ha='right', fontsize=11)
plt.yticks(rotation=0, fontsize=11)
plt.tight_layout()

out_file = "correlation_heatmap_11_metrics.png"
plt.savefig(out_file, dpi=300)
print(f"Heatmap saved to {out_file}")

