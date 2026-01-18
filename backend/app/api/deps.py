from __future__ import annotations

from typing import Generator, Optional

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
            detail="Not logged in. Please log in.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Session exists but user deleted
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please log in again.",
        )

    if user.status.value != "active":
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive. Contact administrator.",
        )

    return user


def get_redis() -> Optional[redis.Redis]:
    """Get Redis client for caching"""
    try:
        redis_url = settings.REDIS_URL or "redis://localhost:6379/0"
        redis_client = redis.from_url(redis_url, decode_responses=True)
        redis_client.ping()  # Test connection
        return redis_client
    except (redis.exceptions.RedisError, OSError, ValueError):
        # Return None if Redis is not available
        # Services should handle None client gracefully
        return None
