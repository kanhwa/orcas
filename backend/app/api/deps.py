from __future__ import annotations

from typing import Generator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
import redis

from app.db.session import SessionLocal
from app.models import User
from app.core.config import settings


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    Get current user from session.
    Raises 401 if not logged in, 403 if user inactive.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Belum login. Silakan login terlebih dahulu.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Session exists but user deleted
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User tidak ditemukan. Silakan login ulang.",
        )

    if user.status.value != "active":
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun tidak aktif. Hubungi administrator.",
        )

    return user


def get_redis() -> redis.Redis:
    """Get Redis client for caching"""
    try:
        redis_url = settings.REDIS_URL or "redis://localhost:6379/0"
        redis_client = redis.from_url(redis_url)
        redis_client.ping()  # Test connection
        return redis_client
    except Exception:
        # Return None if Redis is not available
        # Services should handle None client gracefully
        return None
