from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import hash_password, verify_password
from app.core.audit import log_audit
from app.models import User, UserStatus
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    UpdateProfileRequest,
    UserMeResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_to_response(user: User) -> UserMeResponse:
    """Convert User model to UserMeResponse."""
    return UserMeResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        middle_name=user.middle_name,
        last_name=user.last_name,
        full_name=user.computed_full_name,
        role=user.role.value,
        status=user.status.value,
    )


@router.post("/login", response_model=UserMeResponse)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> UserMeResponse:
    """
    Authenticate user with username/password and create session.
    """
    ip_address = request.client.host if request.client else None
    user = db.query(User).filter(User.username == payload.username).first()

    if not user or not verify_password(payload.password, user.password_hash):
        # Log failed login attempt
        log_audit(
            db=db,
            user_id=None,
            action="login_failed",
            target_type="user",
            target_id=None,
            details={"username": payload.username},
            ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    if user.status.value != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive. Contact administrator.",
        )

    # Set session
    request.session["user_id"] = user.id
    
    # Log successful login
    log_audit(
        db=db,
        user_id=user.id,
        action="login_success",
        target_type="user",
        target_id=user.id,
        details={"username": user.username},
        ip_address=ip_address,
    )

    return user_to_response(user)


@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserMeResponse:
    """
    Get current authenticated user info from session.
    """
    return user_to_response(current_user)


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Clear session and logout user.
    """
    user_id = request.session.get("user_id")
    ip_address = request.client.host if request.client else None
    
    request.session.clear()
    
    # Log logout
    if user_id:
        log_audit(
            db=db,
            user_id=user_id,
            action="logout",
            target_type="user",
            target_id=user_id,
            details=None,
            ip_address=ip_address,
        )
    
    return {"detail": "Logout successful."}


@router.patch("/profile", response_model=UserMeResponse)
def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMeResponse:
    """
    Update current user's profile (name fields, email).
    """
    if payload.username is not None:
        username_candidate = payload.username.strip()
        if not username_candidate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username cannot be empty.",
            )

        exists = (
            db.query(User)
            .filter(User.username == username_candidate, User.id != current_user.id)
            .first()
        )
        if exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken.",
            )

        current_user.username = username_candidate

    if payload.first_name is not None:
        current_user.first_name = payload.first_name
    if payload.middle_name is not None:
        current_user.middle_name = payload.middle_name if payload.middle_name else None
    if payload.last_name is not None:
        current_user.last_name = payload.last_name
    if payload.email is not None:
        email_candidate = payload.email.strip() if payload.email else None
        if email_candidate:
            exists_email = (
                db.query(User)
                .filter(User.email == email_candidate, User.id != current_user.id)
                .first()
            )
            if exists_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already taken.",
                )
        current_user.email = email_candidate
    
    # Update computed full_name
    parts = [current_user.first_name, current_user.middle_name, current_user.last_name]
    current_user.full_name = " ".join(p for p in parts if p) or current_user.username

    db.commit()
    db.refresh(current_user)

    return user_to_response(current_user)


@router.post("/change-password")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Change current user's password.
    Requires current password verification.
    """
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    
    # Log password change (never log the actual password)
    log_audit(
        db=db,
        user_id=current_user.id,
        action="password_changed",
        target_type="user",
        target_id=current_user.id,
        details={"username": current_user.username},
        ip_address=request.client.host if request.client else None,
    )

    return {"detail": "Password changed successfully."}


# =============================================================================
# MANUAL TEST (curl)
# =============================================================================
#
# 1) Login — sukses (200):
#
#    curl -X POST http://localhost:8000/api/auth/login \
#         -H "Content-Type: application/json" \
#         -d '{"username": "admin", "password": "admin123"}' \
#         -c cookies.txt
#
# 2) Get current user — sukses (200):
#
#    curl -X GET http://localhost:8000/api/auth/me \
#         -b cookies.txt
#
# 3) Logout — sukses (200):
#
#    curl -X POST http://localhost:8000/api/auth/logout \
#         -b cookies.txt -c cookies.txt
#
# 4) Get me setelah logout — gagal (401):
#
#    curl -X GET http://localhost:8000/api/auth/me \
#         -b cookies.txt
#
