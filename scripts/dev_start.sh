#!/bin/bash
set -e

# Script to start both backend and frontend in development mode
# IMPORTANT: This script MUST be run from the repo root directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Starting ORCAS development servers..."
echo "Repository root: $REPO_ROOT"

# Check we're in the right place
if [ ! -d "$REPO_ROOT/frontend" ] || [ ! -d "$REPO_ROOT/backend" ]; then
    echo "ERROR: frontend/ or backend/ directory not found!"
    echo "Please run this script from the repo root: ./scripts/dev_start.sh"
    exit 1
fi

# Kill existing processes if running
echo "==> Checking for existing processes..."
if [ -f "$REPO_ROOT/backend.pid" ]; then
    OLD_PID=$(cat "$REPO_ROOT/backend.pid")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Stopping existing backend (PID: $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null || true
        sleep 1
    fi
    rm -f "$REPO_ROOT/backend.pid"
fi

if [ -f "$REPO_ROOT/vite.pid" ]; then
    OLD_PID=$(cat "$REPO_ROOT/vite.pid")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Stopping existing frontend (PID: $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null || true
        sleep 1
    fi
    rm -f "$REPO_ROOT/vite.pid"
fi

# Start backend
echo "==> Starting backend server..."
cd "$REPO_ROOT/backend"

# Activate virtual environment
if [ -f "$REPO_ROOT/.venv/bin/activate" ]; then
    source "$REPO_ROOT/.venv/bin/activate"
elif [ -f "$REPO_ROOT/backend/.venv/bin/activate" ]; then
    source "$REPO_ROOT/backend/.venv/bin/activate"
else
    echo "WARNING: Virtual environment not found, using system Python"
fi

# Start backend in background
nohup python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
    </dev/null > "$REPO_ROOT/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$REPO_ROOT/backend.pid"
echo "Backend started (PID: $BACKEND_PID, log: backend.log)"

# Wait a moment for backend to initialize
sleep 2

# Start frontend
echo "==> Starting frontend server..."
cd "$REPO_ROOT/frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start frontend in background
# CRITICAL: Run npm INSIDE frontend directory, write logs/PID to repo root
nohup npm run dev -- --host localhost --port 5173 --strictPort \
    </dev/null > "$REPO_ROOT/vite.log" 2>&1 &
VITE_PID=$!
echo $VITE_PID > "$REPO_ROOT/vite.pid"
echo "Frontend started (PID: $VITE_PID, log: vite.log)"

# Wait for servers to start
sleep 3

echo ""
echo "==> Development servers started!"
echo ""
echo "Backend:  http://localhost:8000"
echo "          http://localhost:8000/docs (API docs)"
echo "Frontend: http://localhost:5173"
echo ""
echo "Logs:"
echo "  Backend:  tail -f $REPO_ROOT/backend.log"
echo "  Frontend: tail -f $REPO_ROOT/vite.log"
echo ""
echo "To stop: ./scripts/dev_stop.sh"
echo ""

# Verify servers are running
sleep 2
if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "WARNING: Backend process died! Check backend.log"
fi
if ! ps -p $VITE_PID > /dev/null 2>&1; then
    echo "WARNING: Frontend process died! Check vite.log"
fi
