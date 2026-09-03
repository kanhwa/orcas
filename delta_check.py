import sys
import runpy
from sqlalchemy import text
from backend.app.db.session import SessionLocal
from backend.app.models import Emiten, FinancialData, MetricDefinition
from backend.app.schemas.wsm import SimulationRequest
from backend.app.services.wsm_service import run_simulation

def do_delta_check():
    # Attempt to do manual vs system check
    print("Initiating Delta Check...")
