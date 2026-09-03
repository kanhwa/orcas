import os
import sys
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
db.execute(text("DELETE FROM financial_data WHERE metric_id IN (SELECT id FROM metric_definitions WHERE name = 'Operating Cash Flow')"))
db.commit()
print("Wiped Operating Cash Flow from DB")
