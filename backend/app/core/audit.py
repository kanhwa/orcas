# backend/app/core/audit.py
"""Audit logging helper for tracking important system events."""
from __future__ import annotations

from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models import AuditLog


def log_audit(
    db: Session,
    user_id: Optional[int],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Log an audit event.
    
    Actions:
    - login_success, login_failed, logout
    - password_changed
    - user_created, user_updated, user_deleted
    - data_imported
    
    NEVER log passwords or tokens in details.
    """
    entry = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
