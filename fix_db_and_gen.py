import os
import sys
import csv
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Check what years are in the DB
result = db.execute(text("SELECT DISTINCT year FROM financial_data ORDER BY year")).fetchall()
years = [r[0] for r in result]
print(f"Years in DB: {years}")

