import os
import sys
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from app.models import FinancialData

db = SessionLocal()
# Let's check how many rows 2014 and 2015 have
rows_2014 = db.query(FinancialData).filter(FinancialData.year == 2014).count()
rows_2015 = db.query(FinancialData).filter(FinancialData.year == 2015).count()
print(f"2014 rows: {rows_2014}, 2015 rows: {rows_2015}")

data_2014 = db.query(FinancialData).filter(FinancialData.year == 2014).all()
data_2015 = db.query(FinancialData).filter(FinancialData.year == 2015).all()

dict_2014 = {(d.emiten_id, d.metric_id): d.value for d in data_2014}
dict_2015 = {(d.emiten_id, d.metric_id): d.value for d in data_2015}

print("Is dict_2014 == dict_2015?", dict_2014 == dict_2015)
if dict_2014 != dict_2015:
    keys_2014 = set(dict_2014.keys())
    keys_2015 = set(dict_2015.keys())
    print("Keys diff:", len(keys_2014 ^ keys_2015))
    diff_count = 0
    for k in keys_2014 & keys_2015:
        if dict_2014[k] != dict_2015[k]:
            print(f"Diff at {k}: {repr(dict_2014[k])} vs {repr(dict_2015[k])}")
            diff_count += 1
            if diff_count > 5:
                break
