#!/usr/bin/env python3
"""
Seed script to create default admin user for ORCAS.

Usage:
    cd backend
    python -m app.scripts.seed_admin
"""
from __future__ import annotations

import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User


def seed_admin() -> bool:
    """
    Create default admin user if not exists.
    Returns True if created, False if already exists.
    """
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            return False

        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            full_name="ORCAS Admin",
            role="admin",
            status="active",
        )
        db.add(admin)
        db.commit()
        return True
    finally:
        db.close()


def main() -> int:
    created = seed_admin()
    if created:
        print("Admin user created.")
    else:
        print("Admin user already exists.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
