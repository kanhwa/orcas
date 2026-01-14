from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import redis
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.db.database import ping_db
from app.db.session import SessionLocal
from app.models import MetricDefinition
from app.scripts.seed_metric_definitions import read_mapping, upsert_metrics
from app.api.routes import activity, admin, auth, emitens, export, financial_data, historical, metric_ranking, ranking, reports, scoring_runs, screening, stocks, sync_data, templates, weight_templates, wsm, years, metrics

app = FastAPI(title="ORCAS API")

uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)

# CORS middleware for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Session middleware for cookie-based auth
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    session_cookie="orcas_session",
    https_only=False,  # Set True in production with HTTPS
    same_site="lax",
)

app.include_router(auth.router)
app.include_router(wsm.router)
app.include_router(ranking.router)
app.include_router(emitens.router)
app.include_router(activity.router)
app.include_router(scoring_runs.router)
app.include_router(reports.router)
app.include_router(templates.router)
app.include_router(weight_templates.router)
app.include_router(years.router)
app.include_router(financial_data.router)
app.include_router(export.router)
app.include_router(admin.router)
app.include_router(screening.router)
app.include_router(metric_ranking.router)
app.include_router(metrics.router)
app.include_router(historical.router)
app.include_router(stocks.router)
app.include_router(sync_data.router)

app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


def _seed_metrics_if_empty() -> None:
    """Seed metric_definitions from the canonical CSV when empty."""
    csv_path = Path(__file__).resolve().parents[2] / "data" / "processed" / "metric_type_mapping.csv"
    if not csv_path.is_file():
        return

    db = SessionLocal()
    try:
        existing = db.query(MetricDefinition).count()
        if existing > 0:
            return

        rows = read_mapping(csv_path)
        applied, _ = upsert_metrics(db, rows)
        if applied:
            db.commit()
    except Exception:  # pylint: disable=broad-exception-caught
        db.rollback()
    finally:
        db.close()


@app.on_event("startup")
def _startup_tasks() -> None:
    _seed_metrics_if_empty()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/db-health")
def db_health():
    return {"postgres": "ok" if ping_db() else "failed"}

@app.get("/redis-health")
def redis_health():
    try:
        r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, decode_responses=True)
        return {"redis": "ok" if r.ping() else "failed"}
    except Exception:  # pylint: disable=broad-exception-caught
        return {"redis": "failed"}
