import pandas as pd
try:
    df = pd.read_csv('../data/processed/2024.csv')
    print("Success reading 2024.csv")
    print(df.head(2))
except Exception as e:
    import traceback
    traceback.print_exc()
