import pandas as pd
file_path = "data/raw/DATASET BANKING [IDX].xlsx"
xls = pd.ExcelFile(file_path)
df_bbca = pd.read_excel(xls, sheet_name='BBCA')
print("Columns:", df_bbca.columns.tolist())
