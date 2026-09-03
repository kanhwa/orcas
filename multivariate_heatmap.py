import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt

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

# Extract ALL metrics for heatmapping
for sheet in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet)
    for yr in years:
        if yr not in df.columns: continue
        row_data = {'Emiten': sheet, 'Tahun': yr}
        for _, row in df.iterrows():
            m = str(row['Financial Metrics']).strip()
            if pd.isna(m) or m == 'nan' or m == 'Coverage Ratio': continue
            val = parse_num(row[yr])
            row_data[m] = val
        all_data.append(row_data)

df_all = pd.DataFrame(all_data)
# Drop non-numeric for correlation
df_numeric = df_all.drop(columns=['Emiten', 'Tahun'])

# Calculate Pearson correlation
corr_matrix = df_numeric.corr()

# Find top highly correlated pairs (>0.85 and < 1.0)
sorted_pairs = corr_matrix.unstack().sort_values(ascending=False).drop_duplicates()
high_corr = sorted_pairs[(sorted_pairs > 0.85) & (sorted_pairs < 0.9999)]

print("=== TOP TABRAKAN KORELASI TINGGI (>0.85) ===")
print(high_corr.head(10))

# Find strictly independent or negatively correlated pairs
low_corr_aset = corr_matrix['Total Aset'].sort_values()
print("\n=== METRIK UNIK (KORELASI TERENDAH / NEGATIF TERHADAP TOTAL ASET) ===")
print(low_corr_aset.head(10))

# Generate Heatmap (Sub-sample 12 anchor metrics to make it readable in text)
anchor_metrics = [
    'Total Aset', 'Total Liabilitas', 'Total Ekuitas', 
    'Laba Bersih Tahun Berjalan', 'Pendapatan Bunga Bersih', 'Beban Usaha',
    'Arus Kas Dari Aktivitas Operasi', 'ROA', 'ROE', 'NPL Gross', 'NIM', 'CAR'
]
existing_anchors = [m for m in anchor_metrics if m in corr_matrix.columns]

plt.figure(figsize=(12, 10))
sns.heatmap(corr_matrix[existing_anchors].loc[existing_anchors], annot=True, cmap='coolwarm', fmt=".2f", vmin=-1, vmax=1)
plt.title('Correlation Heatmap Metrik Anchor Perbankan (2015-2024)')
plt.tight_layout()
plt.savefig('correlation_heatmap.png', dpi=300)
print("\nCorrelation heatmap tersimpan: correlation_heatmap.png")
