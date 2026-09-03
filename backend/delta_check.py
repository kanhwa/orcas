import json
from decimal import Decimal
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models import Emiten, FinancialData, MetricDefinition
from app.schemas.wsm import SimulationRequest
from app.services.wsm_service import run_simulation

YEAR = 2024

db = SessionLocal()
# Pick a small sample, e.g. 5 banks
tickers = ["BBCA", "BBRI", "BMRI", "BBNI", "BBTN"]
req = SimulationRequest(
    ticker="BBCA",
    year=YEAR,
    mode="overall",
    missing_policy="zero"
)
resp = run_simulation(db, req, user_id=None)

system_scores = {r.ticker: r.score for r in resp.ranking}
print(system_scores)

# Let's see the metrics used
metrics = db.query(MetricDefinition).filter(MetricDefinition.is_active == True).all()
metric_dict = {m.id: m for m in metrics}

# Fetch data for these tickers
emiten_dict = {e.ticker_code: e.id for e in db.query(Emiten).all()}

db.close()
