import os
import sys
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
db.execute(text("DELETE FROM financial_data WHERE year = 2015"))
db.execute(text("DELETE FROM import_history WHERE year = 2015"))
db.commit()
print("2015 data wiped from database.")
