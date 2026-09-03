import pandas as pd
import numpy as np

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
            if not pd.isna(a_val):
                data_aset.append({'Emiten': sheet, 'Tahun': yr, 'Value': a_val})
        if roa_mask.any():
            r_val = parse_num(df[roa_mask].iloc[0][yr])
            if not pd.isna(r_val):
                data_roa.append({'Emiten': sheet, 'Tahun': yr, 'Value': r_val})

df_aset = pd.DataFrame(data_aset)
df_roa = pd.DataFrame(data_roa)

def calc_stats(df, name):
    desc = df['Value'].describe()
    return {
        'Metrik': name, 'Mean': desc['mean'], 'Median': desc['50%'],
        'Min': desc['min'], 'Max': desc['max'], 'Std_Dev': desc['std']
    }

stats_df = pd.DataFrame([calc_stats(df_aset, 'Total Aset'), calc_stats(df_roa, 'ROA')])

print("=== STATISTIK ===")
for i, r in stats_df.iterrows():
    print(f"| {r['Metrik']} | {r['Mean']:,.2f} | {r['Median']:,.2f} | {r['Min']:,.2f} | {r['Max']:,.2f} | {r['Std_Dev']:,.2f} |")

def get_outliers(df):
    Q1 = df['Value'].quantile(0.25)
    Q3 = df['Value'].quantile(0.75)
    IQR = Q3 - Q1
    out_lower = df[df['Value'] < (Q1 - 1.5 * IQR)]
    out_upper = df[df['Value'] > (Q3 + 1.5 * IQR)]
    return out_lower, out_upper
    
aset_out_low, aset_out_up = get_outliers(df_aset)
roa_out_low, roa_out_up = get_outliers(df_roa)

print("\n=== OUTLIER ATAS TOTAL ASET (RAKSASA) ===")
top_aset = aset_out_up.groupby('Emiten').size().reset_index(name='Count')
for i, r in top_aset.sort_values(by='Count', ascending=False).iterrows(): print(f"- **{r['Emiten']}** ({r['Count']} tahun masuk kategori Raksasa)")

print("\n=== OUTLIER ROA BAWAH (RUGI EKSTREM) ===")
for i, r in roa_out_low.sort_values('Value').head(12).iterrows(): print(f"- **{r['Emiten']}** ({r['Tahun']}): {r['Value']:,.2f}%")

print("\n=== OUTLIER ROA ATAS (UNTUNG EKSTREM) ===")
for i, r in roa_out_up.sort_values('Value', ascending=False).head(5).iterrows(): print(f"- **{r['Emiten']}** ({r['Tahun']}): {r['Value']:,.2f}%")

