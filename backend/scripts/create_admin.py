"""
One-Time Idempotent Admin / Recruiter Provisioning Script

Usage:
  # Via environment variables:
  ADMIN_EMAIL="admin@interviewai.com" ADMIN_PASSWORD="SecurePassword123!" python scripts/create_admin.py

  # Or interactively:
  python scripts/create_admin.py

Features:
- Idempotent: Creates user if missing, updates password and role if already exists
- Secure: Uses bcrypt password hashing, never logs plaintext passwords
- Works with MongoDB Atlas (or local resilient store if offline)
"""

import os
import sys
import getpass
from datetime import datetime
from pathlib import Path
import bcrypt

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from db.mongo_client import get_collection, get_mongo_client
from db.models import Collections

def provision_admin():
    print("=" * 60)
    print(" 🛡️  RECRUITER / ADMIN USER PROVISIONING TOOL")
    print("=" * 60)

    # 1. Resolve email
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if not email:
        try:
            email = input("Enter Recruiter/Admin Email Address: ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    if not email or "@" not in email:
        print("❌ Error: A valid email address is required.")
        sys.exit(1)

    # 2. Resolve password
    password = os.getenv("ADMIN_PASSWORD", "")
    if not password:
        try:
            password = getpass.getpass("Enter Secure Password (min 8 chars): ")
            confirm = getpass.getpass("Confirm Password: ")
            if password != confirm:
                print("❌ Error: Passwords do not match.")
                sys.exit(1)
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    if len(password) < 8:
        print("❌ Error: Password must be at least 8 characters long.")
        sys.exit(1)

    # 3. Resolve role and name
    name = os.getenv("ADMIN_NAME", "Lead Recruiter").strip()
    role = os.getenv("ADMIN_ROLE", "RECRUITER").strip().upper()
    if role not in ("RECRUITER", "ADMIN", "HIRING_MANAGER"):
        role = "RECRUITER"

    company = os.getenv("ADMIN_COMPANY", "Talent Acquisition").strip()

    # 4. Hash password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    # 5. Connect to database
    try:
        users = get_collection(Collections.USERS)
        existing = users.find_one({"email": email})

        now = datetime.utcnow()
        if existing:
            # Update existing user
            users.update_one(
                {"email": email},
                {
                    "$set": {
                        "password": hashed_password,
                        "password_hash": hashed_password,
                        "name": name,
                        "full_name": name,
                        "role": role,
                        "company": company,
                        "is_active": True,
                        "updated_at": now
                    }
                }
            )
            print(f"✅ User updated successfully: {email}")
            print(f"   Role: {role}")
            print(f"   Name: {name}")
            print(f"   Database Status: Updated existing account")
        else:
            # Insert new user
            user_doc = {
                "email": email,
                "password": hashed_password,
                "password_hash": hashed_password,
                "name": name,
                "full_name": name,
                "role": role,
                "company": company,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
                "last_login": None
            }
            users.insert_one(user_doc)
            print(f"✅ User created successfully: {email}")
            print(f"   Role: {role}")
            print(f"   Name: {name}")
            print(f"   Database Status: Created new account")

        print("=" * 60)
        print("🎉 You can now sign in at /login with these credentials!")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    provision_admin()
