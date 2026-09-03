import sys
import os
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.db.database import SessionLocal
from app.api.routes.sync_data import parse_value
from app.db.models import FinancialData, Emiten, MetricDefinition

db = SessionLocal()

# Get 2018 db keys
db_data = db.query(FinancialData).filter(FinancialData.year == 2018).all()
db_keys = set((d.emiten_id, d.metric_id) for d in db_data)

# Read 2018 csv
from app.api.routes.sync_data import validate_and_import_csv
with open('data/processed/2018.csv', 'r') as f:
    content = f.read()

# I can't easily isolate the parsing logic without mocking. Let's just look at the db keys
print(f"DB keys length: {len(db_keys)}")

# Let's see what are the 10 keys diff
# We can do this by getting 2014 db keys (which was just inserted from the clone)
db_data_2014 = db.query(FinancialData).filter(FinancialData.year == 2014).all()
db_keys_2014 = set((d.emiten_id, d.metric_id) for d in db_data_2014)

print(f"2014 keys length: {len(db_keys_2014)}")

diff_keys = db_keys ^ db_keys_2014
print("Diff keys:")
for ek, mk in diff_keys:
    em = db.query(Emiten).filter(Emiten.id == ek).first()
    mt = db.query(MetricDefinition).filter(MetricDefinition.id == mk).first()
    in_2018 = (ek, mk) in db_keys
    in_2014 = (ek, mk) in db_keys_2014
    print(f"Emiten: {em.ticker_code}, Metric: {mt.metric_name}, in 2018: {in_2018}, in 2014: {in_2014}")
