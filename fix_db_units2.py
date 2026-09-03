import csv
import json
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from sqlalchemy import text
from app.db.session import SessionLocal

db = SessionLocal()

with open("backend/app/resources/metric_unit_mapping.csv", "r") as f:
    reader = csv.DictReader(f)
    for row in reader:
        metric_name = row["metric_name"].strip()
        display_unit = row["display_unit"].strip()
        input_mode = row.get("input_mode", "as_is").strip()
        allow_negative = row.get("allow_negative", "False").strip().lower() == "true"
        
        unit_config = {
            "unit": display_unit,
            "input_mode": input_mode,
            "allow_negative": allow_negative
        }
        
        db.execute(
            text("UPDATE metric_definitions SET unit_config = :config WHERE metric_name = :name"),
            {"config": json.dumps(unit_config), "name": metric_name}
        )
        print(f"Updated {metric_name} -> {display_unit}")

db.commit()
db.close()
print("Done fixing database units!")
