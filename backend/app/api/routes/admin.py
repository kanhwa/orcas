from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User, UserRole, UserStatus
from app.schemas.admin import UserListResponse, UserOut, UserUpdateRequest

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures current user is admin."""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


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
    users = db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return UserListResponse(
        total=total,
        users=[
            UserOut(
                id=u.id,
                username=u.username,
                full_name=u.full_name,
                role=u.role.value,
                status=u.status.value,
                created_at=u.created_at.isoformat(),
            )
            for u in users
        ],
    )


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

    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,
        status=user.status.value,
        created_at=user.created_at.isoformat(),
    )


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserOut:
    """
    Update a user's profile, role, or status (admin only).
    Cannot demote yourself from admin.
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

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = UserRole(payload.role)
    if payload.status is not None:
        user.status = UserStatus(payload.status)

    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,
        status=user.status.value,
        created_at=user.created_at.isoformat(),
    )


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    """
    Delete a user (admin only).
    Cannot delete yourself.
    """
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
