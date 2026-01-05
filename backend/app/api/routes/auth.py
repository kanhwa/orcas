from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import hash_password, verify_password
from app.models import User, UserRole, UserStatus
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserMeResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserMeResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> UserMeResponse:
    """
    Register a new user account.
    New users get 'user' role by default.
    """
    # Check if username already exists
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username sudah digunakan.",
        )

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.user,
        status=UserStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserMeResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,
        status=user.status.value,
    )


@router.post("/login", response_model=UserMeResponse)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> UserMeResponse:
    """
    Authenticate user with username/password and create session.
    """
    user = db.query(User).filter(User.username == payload.username).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah.",
        )

    if user.status.value != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun tidak aktif. Hubungi administrator.",
        )

    # Set session
    request.session["user_id"] = user.id

    return UserMeResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,
        status=user.status.value,
    )


@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserMeResponse:
    """
    Get current authenticated user info from session.
    """
    return UserMeResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role.value,
        status=current_user.status.value,
    )


@router.post("/logout")
def logout(request: Request) -> dict:
    """
    Clear session and logout user.
    """
    request.session.clear()
    return {"detail": "Logout berhasil."}


@router.patch("/profile", response_model=UserMeResponse)
def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMeResponse:
    """
    Update current user's profile (full_name).
    """
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    db.commit()
    db.refresh(current_user)

    return UserMeResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role.value,
        status=current_user.status.value,
    )


@router.post("/change-password")
def change_password(
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
            detail="Password saat ini salah.",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"detail": "Password berhasil diubah."}


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
