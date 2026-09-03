import psycopg2

conn = psycopg2.connect(
    dbname="orcas_db",
    user="orcas_user",
    password="orcas_pass",
    host="localhost",
    port="5432"
)
cur = conn.cursor()
cur.execute("SELECT metric_name FROM metric_definitions;")
for row in cur.fetchall():
    print(row[0])
