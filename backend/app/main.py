from fastapi import FastAPI
import redis
from app.core.config import settings
from app.db.database import ping_db

app = FastAPI(title="ORCAS API")

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
