import os
import sys
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
res = db.execute(text("SELECT year, COUNT(*) FROM financial_data GROUP BY year ORDER BY year")).fetchall()
print("Years in DB:")
for r in res:
    print(f"{r[0]}: {r[1]} rows")
