import psycopg2
import json

conn = psycopg2.connect(
    dbname="orcas_db",
    user="orcas_user",
    password="orcas_pass",
    host="localhost",
    port="5432"
)
cur = conn.cursor()
cur.execute("SELECT metric_name, unit_config FROM metric_definitions WHERE metric_name = 'Kas Dan Setara Kas';")
row = cur.fetchone()
print(f"Metric: {row[0]}, Unit Config: {row[1]}")
