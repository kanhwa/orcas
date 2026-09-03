import pandas as pd
import numpy as np

file_path = "data/raw/DATASET BANKING [IDX].xlsx"
xls = pd.ExcelFile(file_path)

sheets = xls.sheet_names
print(f"Total sheets: {len(sheets)}")

df_bbca = pd.read_excel(xls, sheet_name='BBCA')
print(f"BBCA shape: {df_bbca.shape}")
print(df_bbca['Metric'].values)

