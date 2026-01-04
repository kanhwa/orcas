from __future__ import annotations

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plain-text password using PBKDF2-SHA256."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a PBKDF2-SHA256 hash."""
    return pwd_context.verify(plain, hashed)
