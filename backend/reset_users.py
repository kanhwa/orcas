import os
import sys

# Tambahkan path backend agar app bisa di-import
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.models import User
from app.core.security import hash_password

def reset_users():
    db = SessionLocal()
    try:
        # Hapus semua user
        db.query(User).delete()
        
        # Buat Admin
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin",
            status="active",
            email="admin@orcas.com",
            first_name="Super",
            last_name="Admin",
        )
        db.add(admin)
        
        # Buat Employee
        employee = User(
            username="employee",
            password_hash=hash_password("employee123"),
            role="employee",
            status="active",
            email="employee@orcas.com",
            first_name="Regular",
            last_name="Employee",
        )
        db.add(employee)
        
        db.commit()
        print("RESET_SUCCESS")
    except Exception as e:
        db.rollback()
        print(f"RESET_FAILED: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_users()
