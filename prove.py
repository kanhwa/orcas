import os
import sys
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from app.models.models import FinancialData, Metric

db = SessionLocal()
res = db.execute(text("SELECT metric_id, COUNT(*) FROM financial_data WHERE year=2016 GROUP BY metric_id")).fetchall()
print(f"2016 has {len(res)} distinct metrics")
