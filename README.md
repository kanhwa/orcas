# ORCAS

Web-based Decision Support System for banking financial health analysis (EDA + WSM).
Tech stack: React, FastAPI, PostgreSQL, Redis.

### Redis usage
- Redis is provisioned via Docker Compose and used for response caching on WSM endpoints (`/api/wsm/score-preview`, `/api/wsm/simulate`, `/api/wsm/compare`).
- Config: `REDIS_HOST`, `REDIS_PORT`, `REDIS_CACHE_ENABLED` (default true), `REDIS_CACHE_TTL_SECONDS` (default 300s).
- Health checks: `/redis-health` and `/db-health` on the backend.
- If Redis is down, API falls back gracefully (no cache).

## Development

This is a monorepo with:
- **Frontend**: `/frontend` (React + TypeScript + Vite)
- **Backend**: `/backend` (FastAPI + Python)

### Quick Start

```bash
# Start both servers (from repo root)
./scripts/dev_start.sh

# Stop both servers
./scripts/dev_stop.sh
```

**URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

**Logs:**
- Frontend: `tail -f vite.log`
- Backend: `tail -f backend.log`

### Manual Setup

If you prefer to run servers manually:

**Backend:**
```bash
cd backend
source ../.venv/bin/activate  # or backend/.venv/bin/activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Note:** Always run `npm` commands from inside the `/frontend` directory, not from the repo root.
