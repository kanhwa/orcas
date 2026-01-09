#!/bin/bash

# Script to stop both backend and frontend development servers
# Can be run from anywhere

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Stopping ORCAS development servers..."

STOPPED_ANY=false

# Stop backend
if [ -f "$REPO_ROOT/backend.pid" ]; then
    BACKEND_PID=$(cat "$REPO_ROOT/backend.pid")
    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        sleep 1
        # Force kill if still running
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            echo "Force killing backend..."
            kill -9 "$BACKEND_PID" 2>/dev/null || true
        fi
        STOPPED_ANY=true
    else
        echo "Backend PID file exists but process not running"
    fi
    rm -f "$REPO_ROOT/backend.pid"
else
    echo "No backend.pid file found"
fi

# Stop frontend
if [ -f "$REPO_ROOT/vite.pid" ]; then
    VITE_PID=$(cat "$REPO_ROOT/vite.pid")
    if ps -p "$VITE_PID" > /dev/null 2>&1; then
        echo "Stopping frontend (PID: $VITE_PID)..."
        kill "$VITE_PID" 2>/dev/null || true
        sleep 1
        # Force kill if still running
        if ps -p "$VITE_PID" > /dev/null 2>&1; then
            echo "Force killing frontend..."
            kill -9 "$VITE_PID" 2>/dev/null || true
        fi
        STOPPED_ANY=true
    else
        echo "Frontend PID file exists but process not running"
    fi
    rm -f "$REPO_ROOT/vite.pid"
else
    echo "No vite.pid file found"
fi

# Fallback: kill by port if PID files didn't work
echo ""
echo "==> Checking for processes on ports 8000 and 5173..."

# Check port 8000 (backend)
PORT_8000_PID=$(lsof -ti:8000 2>/dev/null || true)
if [ -n "$PORT_8000_PID" ]; then
    echo "Found process on port 8000 (PID: $PORT_8000_PID), killing..."
    kill "$PORT_8000_PID" 2>/dev/null || true
    sleep 1
    if lsof -ti:8000 > /dev/null 2>&1; then
        echo "Force killing port 8000..."
        kill -9 "$PORT_8000_PID" 2>/dev/null || true
    fi
    STOPPED_ANY=true
fi

# Check port 5173 (frontend)
PORT_5173_PID=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$PORT_5173_PID" ]; then
    echo "Found process on port 5173 (PID: $PORT_5173_PID), killing..."
    kill "$PORT_5173_PID" 2>/dev/null || true
    sleep 1
    if lsof -ti:5173 > /dev/null 2>&1; then
        echo "Force killing port 5173..."
        kill -9 "$PORT_5173_PID" 2>/dev/null || true
    fi
    STOPPED_ANY=true
fi

# Final check
sleep 1
STILL_RUNNING=""
if lsof -ti:8000 > /dev/null 2>&1; then
    STILL_RUNNING="$STILL_RUNNING port 8000"
fi
if lsof -ti:5173 > /dev/null 2>&1; then
    STILL_RUNNING="$STILL_RUNNING port 5173"
fi

echo ""
if [ -n "$STILL_RUNNING" ]; then
    echo "WARNING: Some processes still running on:$STILL_RUNNING"
    echo "You may need to manually kill them."
    exit 1
elif [ "$STOPPED_ANY" = true ]; then
    echo "==> All development servers stopped successfully!"
else
    echo "==> No development servers were running."
fi
