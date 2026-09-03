import pandas as pd
import numpy as np

file_path = "data/raw/DATASET BANKING [IDX].xlsx"
xls = pd.ExcelFile(file_path)

years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]

# What are all 40 metrics? Let's assume we drop one metric to match exactly 39.
# The user's thesis draft says 530 NaN. Let's trace how 530 could be calculated.
def is_missing(val):
    if pd.isna(val):
        return True
    if isinstance(val, str):
        v = val.strip()
        if v in ['', '-', 'N/A', '#DIV/0!', '#VALUE!', '0', 'NaN', 'null']: # some might consider '0' as missing?
            pass
    return False

missing_strict = 0
missing_coerced = 0
unbalanced = []
total_zeros = 0
total_str_missing = 0

for sheet in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet)
    
    # Check equations
    # Metric strings
    aset_col = df[df['Financial Metrics'].str.contains('Total Aset', na=False, case=False)]
    liab_col = df[df['Financial Metrics'].str.contains('Total Liabilitas', na=False, case=False)]
    ekuitas_col = df[df['Financial Metrics'].str.contains('Total Ekuitas', na=False, case=False)]
    
    # We evaluate for every year
    for yr in years:
        if yr not in df.columns: continue
        
        # Missing values check
        # Convert column to string just to see
        s = df[yr]
        # Just standard pd.isna
        na_count = s.isna().sum()
        
        # Strings that aren't numbers
        str_missing = 0
        for val in s:
            if pd.isna(val): continue
            if isinstance(val, str):
                v = val.strip()
                if not any(char.isdigit() for char in v):
                    str_missing += 1
                elif 'B' in v or 'T' in v or '(' in v:
                    # formatted numbers, not strictly missing
                    pass
        
        missing_strict += na_count
        total_str_missing += str_missing
        
        # Equation Check
        if not aset_col.empty and not liab_col.empty and not ekuitas_col.empty:
            def parse_num(v):
                if pd.isna(v): return np.nan
                if isinstance(v, (int, float)): return float(v)
                v = str(v).strip().replace(',', '')
                is_neg = False
                if '(' in v and ')' in v:
                    is_neg = True
                    v = v.replace('(', '').replace(')', '')
                # remove ' B' etc if exists
                v = v.replace(' B', '').replace(' T', '')
                try:
                    num = float(v)
                    return -num if is_neg else num
                except:
                    return np.nan
            
            a = parse_num(aset_col.iloc[0][yr])
            l = parse_num(liab_col.iloc[0][yr])
            e = parse_num(ekuitas_col.iloc[0][yr])
            
            if pd.isna(a) or pd.isna(l) or pd.isna(e):
                continue
            
            diff = abs(a - (l + e))
            if diff > 1.0:
                unbalanced.append({
                    'emiten': sheet,
                    'year': yr,
                    'aset': a,
                    'liabilitas': l,
                    'ekuitas': e,
                    'diff': a - (l + e)
                })

print(f"Strict NaN count: {missing_strict}")
print(f"String Non-Numeric missing count: {total_str_missing}")

print(f"\nTotal Unbalanced: {len(unbalanced)}")
for u in unbalanced:
    stat = "MINOR (Desimal/Pembulatan)" if abs(u['diff']) < 100 else "EKSTREM (Miliar/Triliun)"
    print(f"- {u['emiten']} ({u['year']}) | Diff: {u['diff']:.2f} | M/E: {stat} | Aset: {u['aset']}, Liab: {u['liabilitas']}, Ekuitas: {u['ekuitas']}")

