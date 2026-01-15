from __future__ import annotations

import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_, cast, String, desc, asc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import hash_password
from app.models import User, UserRole, UserStatus, AuditLog
from app.schemas.admin import (
    UserListResponse, 
    UserOut, 
    UserUpdateRequest, 
    UserCreateRequest,
    AdminCountResponse,
    AuditLogOut,
    AuditLogListResponse,
    AuditLogFilters,
)
from app.core.audit import log_audit

router = APIRouter(prefix="/api/admin", tags=["admin"])

MAX_ADMINS = 2  # Maximum number of admin accounts allowed


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures current user is admin."""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def get_admin_count(db: Session) -> int:
    """Get current number of admin users."""
    return db.query(User).filter(User.role == UserRole.admin).count()


def get_active_admin_count(db: Session) -> int:
    """Get current number of ACTIVE admin users."""
    return db.query(User).filter(
        User.role == UserRole.admin,
        User.status == UserStatus.active
    ).count()


def user_to_out(user: User) -> UserOut:
    """Convert User model to UserOut schema."""
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        middle_name=user.middle_name,
        last_name=user.last_name,
        full_name=user.computed_full_name,
        role=user.role.value,
        status=user.status.value,
        created_at=user.created_at.isoformat(),
    )


@router.get("/admin-count", response_model=AdminCountResponse)
def check_admin_count(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> AdminCountResponse:
    """Check current admin count and availability."""
    count = get_admin_count(db)
    return AdminCountResponse(
        admin_count=count,
        max_admins=MAX_ADMINS,
        can_create_admin=count < MAX_ADMINS,
    )


@router.get("/users", response_model=UserListResponse)
def list_users(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserListResponse:
    """
    List all users (admin only).
    """
    limit = max(1, min(limit, 100))
    skip = max(0, skip)

    total = db.query(User).count()
    admin_count = get_admin_count(db)
    users = db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return UserListResponse(
        total=total,
        admin_count=admin_count,
        users=[user_to_out(u) for u in users],
    )


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    request: Request,
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserOut:
    """
    Create a new user (admin only).
    If max admins (2) already exist, role defaults to employee.
    """
    # Check if username already exists
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )
    
    # Check admin limit
    admin_count = get_admin_count(db)
    role = payload.role
    if role == "admin" and admin_count >= MAX_ADMINS:
        role = "employee"  # Force to employee if admin limit reached
    
    # Hash password (must match the algorithm used by login verification)
    password_hash = hash_password(payload.password)
    
    # Build full name
    parts = [payload.first_name, payload.middle_name, payload.last_name]
    full_name = " ".join(p for p in parts if p) or payload.username
    
    # Create user
    new_user = User(
        username=payload.username,
        password_hash=password_hash,
        email=payload.email,
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        last_name=payload.last_name,
        full_name=full_name,
        role=UserRole(role),
        status=UserStatus.active,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Audit log
    log_audit(
        db=db,
        user_id=admin.id,
        action="user_created",
        target_type="user",
        target_id=new_user.id,
        details={"username": new_user.username, "role": role},
        ip_address=request.client.host if request.client else None,
    )
    
    return user_to_out(new_user)


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserOut:
    """
    Get a specific user by ID (admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user_to_out(user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserOut:
    """
    Update a user's profile, role, or status (admin only).
    - Cannot demote yourself from admin.
    - Cannot deactivate yourself.
    - Cannot deactivate the last active admin.
    - Cannot promote to admin if already 2 admins exist.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if user.id == admin.id and payload.role and payload.role != "admin":
        raise HTTPException(
            status_code=400,
            detail="Cannot demote yourself from admin",
        )
    
    # Prevent admin from deactivating themselves
    if user.id == admin.id and payload.status == "inactive":
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate your own account",
        )
    
    # Prevent deactivating the last active admin
    if payload.status == "inactive" and user.role == UserRole.admin and user.status == UserStatus.active:
        active_admin_count = get_active_admin_count(db)
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot deactivate the last active admin",
            )
    
    # Check admin limit when promoting
    if payload.role == "admin" and user.role != UserRole.admin:
        admin_count = get_admin_count(db)
        if admin_count >= MAX_ADMINS:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot promote to admin: maximum {MAX_ADMINS} admins allowed",
            )

    # Track changes for audit
    changes = {}
    
    # Update fields
    if payload.first_name is not None:
        if user.first_name != payload.first_name:
            changes["first_name"] = {"old": user.first_name, "new": payload.first_name}
        user.first_name = payload.first_name
    if payload.middle_name is not None:
        new_val = payload.middle_name if payload.middle_name else None
        if user.middle_name != new_val:
            changes["middle_name"] = {"old": user.middle_name, "new": new_val}
        user.middle_name = new_val
    if payload.last_name is not None:
        if user.last_name != payload.last_name:
            changes["last_name"] = {"old": user.last_name, "new": payload.last_name}
        user.last_name = payload.last_name
    if payload.email is not None:
        new_val = payload.email if payload.email else None
        if user.email != new_val:
            changes["email"] = {"old": user.email, "new": new_val}
        user.email = new_val
    if payload.role is not None:
        if user.role.value != payload.role:
            changes["role"] = {"old": user.role.value, "new": payload.role}
        user.role = UserRole(payload.role)
    if payload.status is not None:
        if user.status.value != payload.status:
            changes["status"] = {"old": user.status.value, "new": payload.status}
        user.status = UserStatus(payload.status)
    
    # Update computed full_name
    parts = [user.first_name, user.middle_name, user.last_name]
    user.full_name = " ".join(p for p in parts if p) or user.username

    db.commit()
    db.refresh(user)
    
    # Audit log
    if changes:
        log_audit(
            db=db,
            user_id=admin.id,
            action="user_updated",
            target_type="user",
            target_id=user.id,
            details={"username": user.username, "changes": changes},
            ip_address=request.client.host if request.client else None,
        )

    return user_to_out(user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    """
    Delete a user (admin only).
    - Cannot delete yourself.
    - Cannot delete if it would leave 0 active admins.
    """
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting last active admin
    if user.role == UserRole.admin and user.status == UserStatus.active:
        active_admin_count = get_active_admin_count(db)
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last active admin",
            )

    # Store info before delete for audit
    deleted_username = user.username
    deleted_role = user.role.value
    
    db.delete(user)
    db.commit()
    
    # Audit log
    log_audit(
        db=db,
        user_id=admin.id,
        action="user_deleted",
        target_type="user",
        target_id=user_id,
        details={"username": deleted_username, "role": deleted_role},
        ip_address=request.client.host if request.client else None,
    )


class AdminResetPasswordRequest(BaseModel):
    """Admin endpoint: reset a user's password (manual set)."""
    password: str


class AdminEditUsernameRequest(BaseModel):
    """Admin endpoint: edit a user's username."""
    username: str


@router.patch("/users/{user_id}/password", response_model=UserOut)
def admin_reset_password(
    user_id: int,
    payload: AdminResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserOut:
    """
    Admin: Reset a user's password (manual set, no verification of old password).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not payload.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password cannot be empty.",
        )

    # Hash and set new password
    user.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(user)

    # Audit log
    log_audit(
        db=db,
        user_id=admin.id,
        action="user_password_reset",
        target_type="user",
        target_id=user.id,
        details={"username": user.username, "reset_by_admin": True},
        ip_address=request.client.host if request.client else None,
    )

    return user_to_out(user)


@router.patch("/users/{user_id}/username", response_model=UserOut)
def admin_edit_username(
    user_id: int,
    payload: AdminEditUsernameRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserOut:
    """
    Admin: Edit a user's username.
    Validates uniqueness.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_username = payload.username.strip()
    if not new_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty.",
        )

    # Check uniqueness
    existing = (
        db.query(User)
        .filter(User.username == new_username, User.id != user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken.",
        )

    old_username = user.username
    user.username = new_username
    db.commit()
    db.refresh(user)

    # Audit log
    log_audit(
        db=db,
        user_id=admin.id,
        action="user_username_changed",
        target_type="user",
        target_id=user.id,
        details={"old_username": old_username, "new_username": new_username},
        ip_address=request.client.host if request.client else None,
    )

    return user_to_out(user)


# =============================================================================
# Audit Log Endpoints
# =============================================================================


def audit_log_to_out(log: AuditLog, user: Optional[User] = None) -> AuditLogOut:
    """Convert AuditLog model to AuditLogOut schema."""
    return AuditLogOut(
        id=log.id,
        user_id=log.user_id,
        username=user.username if user else None,
        user_role=user.role.value if user else None,
        action=log.action,
        target_type=log.target_type,
        target_id=log.target_id,
        details=log.details,
        ip_address=log.ip_address,
        created_at=log.created_at.isoformat() if log.created_at else "",
    )


@router.get("/audit-logs/filters", response_model=AuditLogFilters)
def get_audit_log_filters(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> AuditLogFilters:
    """
    Get available filter options for audit logs.
    Returns distinct actions and target_types from the database.
    """
    # Get distinct actions
    actions_query = db.query(AuditLog.action).distinct().all()
    actions = sorted([a[0] for a in actions_query if a[0]])

    # Get distinct target_types
    target_types_query = db.query(AuditLog.target_type).distinct().all()
    target_types = sorted([t[0] for t in target_types_query if t[0]])

    return AuditLogFilters(actions=actions, target_types=target_types)


@router.get("/audit-logs", response_model=AuditLogListResponse)
def list_audit_logs(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    user_id: Optional[int] = Query(default=None, description="Filter by user ID"),
    action: Optional[str] = Query(default=None, description="Filter by action type"),
    target_type: Optional[str] = Query(default=None, description="Filter by target type"),
    start_date: Optional[datetime] = Query(default=None, description="Filter from date (ISO format)"),
    end_date: Optional[datetime] = Query(default=None, description="Filter to date (ISO format)"),
    search: Optional[str] = Query(default=None, description="Search in IP address or details"),
    sort_by: str = Query(default="created_at", description="Sort by field"),
    sort_order: str = Query(default="desc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> AuditLogListResponse:
    """
    List audit logs with filtering and pagination (admin only).
    """
    # Base query with left join to get user info
    query = db.query(AuditLog, User).outerjoin(User, AuditLog.user_id == User.id)

    # Apply filters
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    
    if action:
        query = query.filter(AuditLog.action == action)
    
    if target_type:
        query = query.filter(AuditLog.target_type == target_type)
    
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    
    if search:
        search_term = f"%{search}%"
        # Search in IP address or details (cast JSONB to text for search)
        query = query.filter(
            or_(
                AuditLog.ip_address.ilike(search_term),
                cast(AuditLog.details, String).ilike(search_term),
            )
        )

    # Get total count before pagination
    total = query.count()

    # Apply sorting
    sort_column = {
        "created_at": AuditLog.created_at,
        "user_id": AuditLog.user_id,
        "action": AuditLog.action,
    }.get(sort_by, AuditLog.created_at)

    if sort_order == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    # Apply pagination
    skip = (page - 1) * limit
    results = query.offset(skip).limit(limit).all()

    # Convert to response format
    logs = [audit_log_to_out(log, user) for log, user in results]
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return AuditLogListResponse(
        logs=logs,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get("/audit-logs/export")
def export_audit_logs(
    user_id: Optional[int] = Query(default=None),
    action: Optional[str] = Query(default=None),
    target_type: Optional[str] = Query(default=None),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> StreamingResponse:
    """
    Export filtered audit logs as CSV (admin only).
    """
    import csv
    import io

    # Build query with same filters as list endpoint
    query = db.query(AuditLog, User).outerjoin(User, AuditLog.user_id == User.id)

    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if target_type:
        query = query.filter(AuditLog.target_type == target_type)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                AuditLog.ip_address.ilike(search_term),
                cast(AuditLog.details, String).ilike(search_term),
            )
        )

    query = query.order_by(desc(AuditLog.created_at))
    results = query.limit(10000).all()  # Limit export to 10k rows

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "Timestamp", "User ID", "Username", "Role", 
        "Action", "Target Type", "Target ID", "IP Address", "Details"
    ])
    
    # Data rows
    for log, user in results:
        writer.writerow([
            log.id,
            log.created_at.isoformat() if log.created_at else "",
            log.user_id or "",
            user.username if user else "",
            user.role.value if user else "",
            log.action,
            log.target_type or "",
            log.target_id or "",
            log.ip_address or "",
            str(log.details) if log.details else "",
        ])

    output.seek(0)
    
    # Return as streaming response
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"audit_logs_{timestamp}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
