"""
Seed Script - Populate initial candidate pool for local testing.

Usage:
    python backend/scripts/seed_candidates.py
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from services.candidate_service import get_candidate_service, INITIAL_SEED_CANDIDATES
from db.mongo_client import get_collection
from db.models import Collections

def seed():
    print("🌱 Initializing candidate seeding...")
    svc = get_candidate_service()
    col = get_collection(Collections.CANDIDATES)
    
    current_count = col.count_documents({})
    print(f"Current candidate count in DB: {current_count}")
    
    for candidate in INITIAL_SEED_CANDIDATES:
        col.update_one(
            {"email": candidate["email"], "role": candidate["role"]},
            {"$set": candidate},
            upsert=True
        )
        print(f"  ✅ Seeded/Updated: {candidate['name']} ({candidate['role']})")
        
    final_count = col.count_documents({})
    print(f"✨ Seeding complete! Total candidates in DB: {final_count}")

if __name__ == "__main__":
    seed()
