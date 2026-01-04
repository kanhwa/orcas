from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import verify_password
from app.models import User
from app.schemas.auth import LoginRequest, UserMeResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
