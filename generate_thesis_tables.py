import pandas as pd
import numpy as np

file_path = "data/raw/DATASET BANKING [IDX].xlsx"
xls = pd.ExcelFile(file_path)
years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
unbalanced = []
for sheet in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet)
    aset_mask = df['Financial Metrics'].astype(str).str.contains('Total Aset', na=False, case=False)
    liab_mask = df['Financial Metrics'].astype(str).str.contains('Total Liabilitas', na=False, case=False)
    ekuitas_mask = df['Financial Metrics'].astype(str).str.contains('Total Ekuitas', na=False, case=False)
    
    if aset_mask.any() and liab_mask.any() and ekuitas_mask.any():
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
            try:
                return -float(v) if is_neg else float(v)
            except: return np.nan
        
        for yr in years:
            if yr not in df.columns: continue
            a = parse_num(df[aset_mask].iloc[0][yr])
            l = parse_num(df[liab_mask].iloc[0][yr])
            e = parse_num(df[ekuitas_mask].iloc[0][yr])
            
            if pd.isna(a) or pd.isna(l) or pd.isna(e): continue
            
            diff = a - (l + e)
            if abs(diff) > 1.0:
                unbalanced.append({'Emiten': sheet, 'Tahun': yr, 'Aset': a, 'Liab': l, 'Ekuitas': e, 'Deviasi': diff})

unb_df = pd.DataFrame(unbalanced)
if not unb_df.empty:
    unb_df = unb_df[unb_df['Emiten'].isin(['BBRI', 'BKSW', 'ARTO'])]
    for i, r in unb_df.iterrows():
        print(f"| {r['Emiten']} | {r['Tahun']} | {r['Aset']:,.2f} | {r['Liab']+r['Ekuitas']:,.2f} | {r['Deviasi']:,.2f} |")
