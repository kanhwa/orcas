from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.db.database import ping_db
from app.api.routes import auth, wsm, ranking

app = FastAPI(title="ORCAS API")

# CORS middleware for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    except Exception:
        return {"redis": "failed"}
