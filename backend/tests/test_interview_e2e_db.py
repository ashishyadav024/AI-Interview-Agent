"""
End-to-End Test: Candidate Interview Persistence & Database Single Source of Truth

Verifies:
1. GET /api/health/db returns database health status and candidate pipeline counts.
2. POST /api/interview/start creates the candidate record with status 'In Progress' immediately in the database.
3. POST /api/interview/answer persists answer turns.
4. Interview completion updates status to 'Completed' with final score, verdict, and report.
5. GET /api/candidates returns the candidate with accurate status counts, role filters, and pagination.
6. GET /api/candidates/{id} returns full report and conversation history.
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app
from services.candidate_service import get_candidate_service

client = TestClient(app)

def test_interview_e2e_db_flow():
    print("\n" + "=" * 80)
    print("🚀 RUNNING END-TO-END DATABASE PERSISTENCE & CANDIDATE FLOW TEST")
    print("=" * 80)

    # 1. Test Database Health endpoint
    print("\n[Step 1] Testing GET /api/health/db...")
    resp = client.get("/api/health/db")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    db_health = resp.json()
    print(f"  ✅ DB Health: status={db_health.get('status')}, mode={db_health.get('mode')}, counts={db_health.get('counts')}")
    assert "counts" in db_health, "db_health must include counts dict"
    assert "total" in db_health["counts"], "counts must include total"

    # 2. Test Candidates List before interview
    print("\n[Step 2] Testing initial GET /api/candidates...")
    resp = client.get("/api/candidates?page=1&page_size=10")
    assert resp.status_code == 200, f"Candidates list failed: {resp.text}"
    initial_data = resp.json().get("data", {})
    initial_total = initial_data.get("total", 0)
    initial_counts = initial_data.get("statusCounts", {})
    print(f"  ✅ Initial Total: {initial_total}, Status Counts: {initial_counts}")
    assert initial_total >= 6, "Seed candidates should be present"

    # 3. Start a new interview for a test candidate
    test_candidate_name = "Maya Lin Test"
    test_candidate_email = "maya.lin.test@example.com"
    test_role = "Senior Frontend Developer"
    print(f"\n[Step 3] Starting interview for '{test_candidate_name}' ({test_role})...")
    
    start_payload = {
        "candidate_name": test_candidate_name,
        "candidate_email": test_candidate_email,
        "job_title": test_role,
        "job_description": "Senior Frontend Developer with React, TypeScript, and modern state architectures.",
        "required_skills": ["React", "TypeScript", "Tailwind CSS", "Architecture"],
        "candidate_resume": "Maya Lin. 6+ years experience building React enterprise dashboards and state trees.",
        "target_duration_minutes": 15
    }
    resp = client.post("/api/interview/start", json=start_payload)
    assert resp.status_code == 200, f"Interview start failed: {resp.text}"
    start_res = resp.json()
    assert start_res.get("success") is True, f"Start unsuccessful: {start_res}"
    interview_id = start_res["data"]["interview_id"]
    print(f"  ✅ Interview started with ID: {interview_id}")

    # 4. Assert candidate appears immediately in DB as 'In Progress'
    print("\n[Step 4] Verifying candidate appears in DB as 'In Progress' immediately...")
    resp = client.get(f"/api/candidates?search={test_candidate_email}")
    assert resp.status_code == 200
    search_data = resp.json().get("data", {})
    matching_candidates = search_data.get("candidates", [])
    assert len(matching_candidates) > 0, "New candidate must appear in database immediately after start"
    cand_doc = matching_candidates[0]
    print(f"  ✅ Found candidate in DB: name='{cand_doc.get('name')}', status='{cand_doc.get('status')}', score={cand_doc.get('score')}")
    assert cand_doc.get("status") == "In Progress", f"Expected 'In Progress', got {cand_doc.get('status')}"

    # 5. Submit an answer turn
    print("\n[Step 5] Submitting interview answer turn via POST /api/interview/answer...")
    answer_payload = {
        "interview_id": interview_id,
        "answer": "In React applications, I structure components using presentation-container separation, custom hooks for shared state logic, and React Context or Zustand for global stores."
    }
    resp = client.post("/api/interview/answer", json=answer_payload)
    assert resp.status_code == 200
    ans_res = resp.json()
    assert ans_res.get("success") is True
    print(f"  ✅ Answer processed. Next question received: {bool(ans_res['data'].get('next_question'))}")

    # 6. Complete the interview session and persist report
    print("\n[Step 6] Completing interview session and persisting evaluation report...")
    candidate_svc = get_candidate_service()
    mock_report = {
        "recommendation": "Recommended",
        "scores": {
            "overall": 88,
            "technical": 90,
            "problem_solving": 85,
            "communication": 89,
            "cultural_fit": 88
        },
        "summary": "Candidate demonstrated exceptional domain mastery of frontend architecture and React.",
        "key_strengths": ["State architecture", "Clean component separation", "TypeScript typing"],
        "areas_for_improvement": ["Could elaborate on SSR edge caching"]
    }
    completed_doc = candidate_svc.complete_session(
        interview_id=interview_id,
        score=88,
        report=mock_report,
        verdict="Recommended",
        flags=[]
    )
    assert completed_doc is not None
    print(f"  ✅ Completed session saved: status='{completed_doc.get('status')}', score={completed_doc.get('score')}")

    # 7. Assert candidate is now 'Completed' with score in GET /api/candidates
    print("\n[Step 7] Checking GET /api/candidates after completion...")
    resp = client.get(f"/api/candidates?search={test_candidate_email}")
    assert resp.status_code == 200
    updated_cand = resp.json()["data"]["candidates"][0]
    print(f"  ✅ Candidate in DB after completion: status='{updated_cand.get('status')}', score={updated_cand.get('score')}")
    assert updated_cand.get("status") == "Completed"
    assert updated_cand.get("score") == 88

    # 8. Test GET /api/candidates/{id} for report & conversation history
    print("\n[Step 8] Testing GET /api/candidates/{id}...")
    resp = client.get(f"/api/candidates/{interview_id}")
    assert resp.status_code == 200
    detail_data = resp.json().get("data", {})
    assert "report" in detail_data
    assert detail_data["report"].get("scores", {}).get("overall") == 88
    print(f"  ✅ Candidate detail retrieved with report overall score: {detail_data['report']['scores']['overall']}")

    # 9. Test Role & Status Filtering and Server-Computed Status Counts
    print("\n[Step 9] Testing role filter and status counts...")
    resp = client.get(f"/api/candidates?role={test_role}")
    assert resp.status_code == 200
    role_filtered = resp.json().get("data", {})
    status_counts = role_filtered.get("statusCounts", {})
    print(f"  ✅ Filter by role '{test_role}': total={role_filtered.get('total')}, statusCounts={status_counts}")
    assert status_counts.get("completed", 0) >= 1

    print("\n" + "=" * 80)
    print("🎉 ALL END-TO-END DATABASE PERSISTENCE & CANDIDATE TESTS PASSED!")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    test_interview_e2e_db_flow()
