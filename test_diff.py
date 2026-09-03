import os
import sys
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from app.models import FinancialData

db = SessionLocal()

# We know 2014 was successfully uploaded by the user, and 2015 is in the DB.
# Let's compare 2014 and 2015
data_2014 = db.query(FinancialData).filter(FinancialData.year == 2014).all()
data_2015 = db.query(FinancialData).filter(FinancialData.year == 2015).all()

dict_2014 = {(d.emiten_id, d.metric_id): float(d.value) for d in data_2014}
dict_2015 = {(d.emiten_id, d.metric_id): float(d.value) for d in data_2015}

keys1 = set(dict_2014.keys())
keys2 = set(dict_2015.keys())

print(f"Len 2014: {len(keys1)}, Len 2015: {len(keys2)}")
if keys1 != keys2:
    print(f"Keys diff count: {len(keys1 ^ keys2)}")
else:
    diffs = 0
    for k in keys1:
        if dict_2014[k] != dict_2015[k]:
            diffs += 1
            if diffs <= 10:
                print(f"Diff at emiten {k[0]}, metric {k[1]}: 2014={dict_2014[k]} vs 2015={dict_2015[k]}")
    print(f"Total Values diff count: {diffs}")
