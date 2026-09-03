import csv
import json

import os
from sqlalchemy import create_engine, text

# We use the same connection string logic
engine = create_engine("postgresql://orcas_user:orcas_pass@localhost:5432/orcas_db")

with engine.connect() as conn:
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
            
            conn.execute(
                text("UPDATE metric_definitions SET unit_config = :config WHERE metric_name = :name"),
                {"config": json.dumps(unit_config), "name": metric_name}
            )
            print(f"Updated {metric_name} -> {display_unit}")
    
    conn.commit()
print("Done fixing database units!")
