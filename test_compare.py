import os
import sys
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from app.models.models import FinancialData

db = SessionLocal()

# Get 2016 and 2014 data
data_2016 = db.query(FinancialData).filter(FinancialData.year == 2016).all()
data_2014 = db.query(FinancialData).filter(FinancialData.year == 2014).all()

dict_2016 = {(d.emiten_id, d.metric_id): round(float(d.value), 4) for d in data_2016}
dict_2014 = {(d.emiten_id, d.metric_id): round(float(d.value), 4) for d in data_2014}

print(f"Len 2016: {len(dict_2016)}")
print(f"Len 2014: {len(dict_2014)}")

keys1 = set(dict_2014.keys())
keys2 = set(dict_2016.keys())
print(f"Keys match: {keys1 == keys2}")
if keys1 != keys2:
    print(f"Keys diff count: {len(keys1 ^ keys2)}")

diffs = 0
for k in keys1.intersection(keys2):
    if dict_2014[k] != dict_2016[k]:
        diffs += 1
        if diffs <= 5:
            print(f"Diff at {k}: 2014={dict_2014[k]} 2016={dict_2016[k]}")

print(f"Total diffs: {diffs}")

