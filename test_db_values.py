import os
import sys
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from app.models import FinancialData, Emiten, MetricDefinition

db = SessionLocal()
m = db.query(MetricDefinition).filter(MetricDefinition.id == 37).first()
e = db.query(Emiten).filter(Emiten.id == 21).first()

v14 = db.query(FinancialData).filter(FinancialData.year == 2014, FinancialData.metric_id == 37, FinancialData.emiten_id == 21).first()
v15 = db.query(FinancialData).filter(FinancialData.year == 2015, FinancialData.metric_id == 37, FinancialData.emiten_id == 21).first()

print(f"Emiten: {e.ticker_code}, Metric: {m.metric_name}")
print(f"2014 Value in DB: {v14.value}")
print(f"2015 Value in DB: {v15.value}")
