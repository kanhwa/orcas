from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.hash import bcrypt

from app.api.deps import get_current_user, get_db
from app.models import User, UserRole, UserStatus
from app.schemas.admin import (
    UserListResponse, 
    UserOut, 
    UserUpdateRequest, 
    UserCreateRequest,
    AdminCountResponse
)

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
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
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
    
    # Hash password
    password_hash = bcrypt.hash(payload.password)
    
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
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserOut:
    """
    Update a user's profile, role, or status (admin only).
    - Cannot demote yourself from admin.
    - Cannot promote to admin if already 2 admins exist.
    - Can only promote employee to admin if only 1 admin exists.
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
    
    # Check admin limit when promoting
    if payload.role == "admin" and user.role != UserRole.admin:
        admin_count = get_admin_count(db)
        if admin_count >= MAX_ADMINS:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot promote to admin: maximum {MAX_ADMINS} admins allowed",
            )

    # Update fields
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.middle_name is not None:
        user.middle_name = payload.middle_name if payload.middle_name else None
    if payload.last_name is not None:
        user.last_name = payload.last_name
    if payload.email is not None:
        user.email = payload.email if payload.email else None
    if payload.role is not None:
        user.role = UserRole(payload.role)
    if payload.status is not None:
        user.status = UserStatus(payload.status)
    
    # Update computed full_name
    parts = [user.first_name, user.middle_name, user.last_name]
    user.full_name = " ".join(p for p in parts if p) or user.username

    db.commit()
    db.refresh(user)

    return user_to_out(user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    """
    Delete a user (admin only).
    - Cannot delete yourself.
    - Cannot delete if it would leave 0 admins.
    """
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting last admin
    if user.role == UserRole.admin:
        admin_count = get_admin_count(db)
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete: at least one admin must exist",
            )

    db.delete(user)
    db.commit()
