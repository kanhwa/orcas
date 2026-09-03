import pandas as pd
import numpy as np

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
            if pd.isna(m) or m == 'nan' or m == 'Coverage Ratio': continue
            row_data[m] = parse_num(row[yr])
        all_data.append(row_data)

df_all = pd.DataFrame(all_data)
anchors = ['Total Aset', 'Total Liabilitas', 'Total Ekuitas', 
    'Laba Bersih Tahun Berjalan', 'Pendapatan Bunga Bersih', 'Beban Usaha',
    'Arus Kas Dari Aktivitas Operasi', 'ROA', 'ROE', 'NPL Gross', 'NIM', 'CAR']
    
existing = [m for m in anchors if m in df_all.columns]
df_anchors = df_all[existing]
corr_matrix = df_anchors.corr()

c = corr_matrix.unstack().drop_duplicates().sort_values(ascending=False)
c = c[(c < 0.999999)]

print("=== POSITIF TERKUAT ===")
print(c.head(10))

print("\n=== NEGATIF TERKUAT ===")
print(c.tail(5))

print("\n=== KORELASI ROA DGN SKALA ===")
print(corr_matrix['ROA'][['Total Aset', 'Total Liabilitas']])

