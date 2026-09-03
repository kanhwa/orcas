import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

file_path = "data/raw/DATASET BANKING [IDX].xlsx"
xls = pd.ExcelFile(file_path)
years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
data_cf = []

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
    # Finding the row for Operating Cash Flow. It might be named differently, trying a few keywords:
    cf_mask = df['Financial Metrics'].astype(str).str.contains('Arus Kas.*Operasi', na=False, case=False)
    
    for yr in years:
        if yr not in df.columns: continue
        if cf_mask.any():
            cf_val = parse_num(df[cf_mask].iloc[0][yr])
            if not pd.isna(cf_val): data_cf.append({'Emiten': sheet, 'Tahun': str(yr), 'Cashflow': cf_val})

df_cf = pd.DataFrame(data_cf)

if df_cf.empty:
    print("WARNING: Data 'Arus Kas' tidak ditemukan. Pastikan nama metrik di Excel.")
else:
    # 1. Descriptive Stats
    desc = df_cf['Cashflow'].describe()
    print("=== STATISTIK ARUS KAS OPERASI ===")
    print(f"| Metrik | Mean | Median (Q2) | Min | Max | Std Dev |")
    print(f"| :--- | ---: | ---: | ---: | ---: | ---: |")
    print(f"| Arus Kas Operasi (Miliar Rp) | {desc['mean']:,.2f} | {desc['50%']:,.2f} | {desc['min']:,.2f} | {desc['max']:,.2f} | {desc['std']:,.2f} |")

    # 2. Outliers
    Q1 = df_cf['Cashflow'].quantile(0.25)
    Q3 = df_cf['Cashflow'].quantile(0.75)
    IQR = Q3 - Q1
    out_lower = df_cf[df_cf['Cashflow'] < (Q1 - 1.5 * IQR)]
    out_upper = df_cf[df_cf['Cashflow'] > (Q3 + 1.5 * IQR)]
    
    print("\n=== OUTLIER ATAS (CASHFLOW EKSTREM POSITIF) ===")
    top_cf = out_upper.groupby('Emiten').size().reset_index(name='Count').sort_values(by='Count', ascending=False)
    for i, r in top_cf.iterrows(): print(f"- **{r['Emiten']}** ({r['Count']} tahun outliers atas)")
    
    print("\n=== OUTLIER BAWAH (CASHFLOW EKSTREM NEGATIF / DEFISIT) ===")
    bot_cf = out_lower.sort_values('Cashflow').head(15)
    for i, r in bot_cf.iterrows(): print(f"- **{r['Emiten']}** ({r['Tahun']}): {r['Cashflow']:,.2f}")

    # 3. Plotting
    plt.figure(figsize=(8, 6))
    sns.boxplot(y='Cashflow', data=df_cf, color='orange', showfliers=True)
    plt.title('Distribusi Arus Kas Dari Aktivitas Operasi (2015-2024)')
    plt.ylabel('Rupiah (Miliar)')
    plt.tight_layout()
    plt.savefig('boxplot_cashflow.png', dpi=300)
    print("\nBerhasil menyimpan boxplot_cashflow.png")
