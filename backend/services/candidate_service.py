"""
Candidate Service - Database Single Source of Truth for Candidate & Interview Data

Handles:
- Candidate and interview lifecycle persistence
- Schema validation, indexing, and deduplication
- Server-side filtering, searching, sorting, and pagination
- Real-time status counts computation
- Bulk status updates (reject, undo-reject, shortlist)
- DB health diagnostics
"""

import logging
import math
import os
import uuid
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple
from db.mongo_client import get_collection, get_mongo_client
from db.models import Collections

logger = logging.getLogger(__name__)

INITIAL_SEED_CANDIDATES = [
    {
        "id": "cand-1",
        "name": "Aarav Sharma",
        "email": "aarav.sharma@example.com",
        "role": "Senior Frontend Engineer",
        "job_id": "job-fe-01",
        "interview_type": "AI Async",
        "status": "Shortlisted",
        "score": 88,
        "verdict": "Recommended",
        "completed_at": "Today, 10:30 AM",
        "scheduled_time": None,
        "skills": ["React", "TypeScript", "Next.js", "State Architecture", "Tailwind CSS"],
        "tab_switches": 0,
        "flags": [],
        "recording_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "resume_text": "Aarav Sharma. 5+ years experience building large-scale frontend applications, component design systems, and state architectures using React and TypeScript.",
        "organization": "default_org",
        "created_at": "2026-11-19T05:00:00Z",
        "updated_at": "2026-11-19T05:00:00Z",
        "avatar_bg": "bg-emerald-50 text-emerald-700",
        "initials": "AS",
        "report": {
            "recommendation": "Recommended",
            "scores": {
                "overall": 88,
                "technical": 91,
                "problem_solving": 86,
                "communication": 89,
                "cultural_fit": 85
            },
            "summary": "Candidate demonstrated exceptional mastery of React architecture, concurrent rendering, and custom hooks. Articulated trade-offs with high verbal clarity and precision.",
            "key_strengths": [
                "Deep knowledge of React concurrent rendering and state architecture",
                "Strong TypeScript typing hygiene and interface contracts",
                "Clear system-level trade-off analysis during technical questioning"
            ],
            "areas_for_improvement": [
                "Could explore WebAssembly optimizations for client-side compute-heavy workloads",
                "Deepen familiarity with edge middleware caching strategies"
            ],
            "interview_date": "11/19/2026",
            "duration_minutes": 18,
            "total_questions": 8
        }
    },
    {
        "id": "cand-2",
        "name": "Priya Mehta",
        "email": "priya.m@techstudio.dev",
        "role": "Full Stack Engineer",
        "job_id": "job-fs-02",
        "interview_type": "AI Async",
        "status": "Completed",
        "score": 76,
        "verdict": "Recommended",
        "completed_at": "Today, 09:15 AM",
        "scheduled_time": None,
        "skills": ["Java", "Spring Boot", "Angular", "PostgreSQL", "REST APIs"],
        "tab_switches": 0,
        "flags": [],
        "recording_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        "resume_text": "Priya Mehta. Full Stack Engineer with 4 years building enterprise applications using Spring Boot microservices, Angular frontend, and relational databases.",
        "organization": "default_org",
        "created_at": "2026-11-19T03:30:00Z",
        "updated_at": "2026-11-19T03:30:00Z",
        "avatar_bg": "bg-blue-50 text-blue-700",
        "initials": "PM",
        "report": {
            "recommendation": "Recommended",
            "scores": {
                "overall": 76,
                "technical": 78,
                "problem_solving": 75,
                "communication": 76,
                "cultural_fit": 75
            },
            "summary": "Solid backend fundamentals in Spring Boot REST controllers, ORM entity mappings, and relational database indexing. Good foundational knowledge of Angular component lifecycle.",
            "key_strengths": [
                "Strong understanding of PostgreSQL indexing and query joins",
                "Proficient in Spring Boot dependency injection and modular service layering",
                "Clear verbal articulation on API contract design"
            ],
            "areas_for_improvement": [
                "Could deepen familiarity with microservice resilience patterns (e.g. circuit breakers, Kafka retries)",
                "Expand on Angular state management patterns (Signals / NgRx)"
            ],
            "interview_date": "11/19/2026",
            "duration_minutes": 15,
            "total_questions": 8
        }
    },
    {
        "id": "cand-3",
        "name": "Kabir Malhotra",
        "email": "kabir.m@neural.network",
        "role": "Backend Systems Engineer",
        "job_id": "job-be-03",
        "interview_type": "AI Async",
        "status": "Pending Review",
        "score": 72,
        "verdict": "Review Needed",
        "completed_at": "Yesterday, 04:30 PM",
        "scheduled_time": None,
        "skills": ["Node.js", "Python", "PostgreSQL", "Redis", "Distributed Systems"],
        "tab_switches": 1,
        "flags": [
            {
                "type": "long silence",
                "reason": "Extended silence detected before answering technical architecture prompt",
                "time": "Yesterday, 04:38 PM"
            }
        ],
        "recording_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "resume_text": "Kabir Malhotra. Backend engineer focused on high-throughput asynchronous services, caching topologies, and PostgreSQL optimizations.",
        "organization": "default_org",
        "created_at": "2026-11-18T11:00:00Z",
        "updated_at": "2026-11-18T11:00:00Z",
        "avatar_bg": "bg-amber-50 text-amber-700",
        "initials": "KM",
        "report": {
            "recommendation": "Under Consideration",
            "scores": {
                "overall": 72,
                "technical": 74,
                "problem_solving": 70,
                "communication": 71,
                "cultural_fit": 73
            },
            "summary": "Good grasp of Node.js event loop, asynchronous IO, and Redis caching layers. Took notable hesitation on distributed locking and consensus protocols, requiring manual reviewer sign-off.",
            "key_strengths": [
                "Practical understanding of Redis key eviction and caching strategies",
                "Clean schema design for relational databases",
                "Honest self-awareness about edge-case limitations"
            ],
            "areas_for_improvement": [
                "Distributed transactions (2PC / Saga pattern)",
                "Confidence during unscripted system scaling scenarios"
            ],
            "interview_date": "11/18/2026",
            "duration_minutes": 16,
            "total_questions": 8
        }
    },
    {
        "id": "cand-4",
        "name": "Ananya Singh",
        "email": "ananya.s@analytics.org",
        "role": "Machine Learning Engineer",
        "job_id": "job-mle-04",
        "interview_type": "AI Async",
        "status": "Shortlisted",
        "score": 92,
        "verdict": "Recommended",
        "completed_at": "Yesterday, 11:20 AM",
        "scheduled_time": None,
        "skills": ["Python", "PyTorch", "Transformers", "FastAPI", "Vector DBs"],
        "tab_switches": 0,
        "flags": [],
        "recording_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "resume_text": "Ananya Singh. ML Engineer specializing in generative AI workflows, RAG architectures, model quantization, and production inference serving.",
        "organization": "default_org",
        "created_at": "2026-11-18T05:50:00Z",
        "updated_at": "2026-11-18T05:50:00Z",
        "avatar_bg": "bg-purple-50 text-purple-700",
        "initials": "AS",
        "report": {
            "recommendation": "Recommended",
            "scores": {
                "overall": 92,
                "technical": 95,
                "problem_solving": 92,
                "communication": 90,
                "cultural_fit": 91
            },
            "summary": "Exceptional performance. Articulated fine-tuning vs RAG trade-offs, vector similarity search indexes (HNSW, IVFFlat), and quantization strategies (LoRA, QLoRA) with stellar technical precision.",
            "key_strengths": [
                "Command over LLM deployment pipelines and latency optimization",
                "Rigorous statistical and mathematical foundation",
                "Concise, articulate verbal explanations with real production insights"
            ],
            "areas_for_improvement": [
                "Could gain more experience with multi-modal tensor streaming architectures"
            ],
            "interview_date": "11/18/2026",
            "duration_minutes": 20,
            "total_questions": 8
        }
    },
    {
        "id": "cand-5",
        "name": "Devina Roy",
        "email": "devina.roy@cloudsystems.net",
        "role": "Data Engineer",
        "job_id": "job-de-05",
        "interview_type": "AI Async",
        "status": "Completed",
        "score": 81,
        "verdict": "Recommended",
        "completed_at": "2 days ago",
        "scheduled_time": None,
        "skills": ["Apache Spark", "SQL", "Airflow", "Kafka", "Snowflake"],
        "tab_switches": 0,
        "flags": [],
        "recording_url": None,
        "resume_text": "Devina Roy. Data Engineer with 4+ years designing high-volume data pipelines, real-time Kafka event streaming, and analytical warehouses.",
        "organization": "default_org",
        "created_at": "2026-11-17T09:00:00Z",
        "updated_at": "2026-11-17T09:00:00Z",
        "avatar_bg": "bg-cyan-50 text-cyan-700",
        "initials": "DR",
        "report": {
            "recommendation": "Recommended",
            "scores": {
                "overall": 81,
                "technical": 83,
                "problem_solving": 80,
                "communication": 82,
                "cultural_fit": 79
            },
            "summary": "Strong experience in designing resilient ETL/ELT pipelines, streaming data ingestion using Kafka, and batch transformations using PySpark.",
            "key_strengths": [
                "Deep knowledge of data warehouse partitioning and clustering",
                "Robust DAG construction and dependency management in Airflow"
            ],
            "areas_for_improvement": [
                "Expand on modern Iceberg/Delta Lake ACID transaction semantics"
            ],
            "interview_date": "11/17/2026",
            "duration_minutes": 16,
            "total_questions": 8
        }
    },
    {
        "id": "cand-6",
        "name": "Rohan Verma",
        "email": "rohan.v@cloudscale.io",
        "role": "Cloud & DevOps Engineer",
        "job_id": "job-devops-06",
        "interview_type": "Live Video",
        "status": "Scheduled",
        "score": 0,
        "verdict": "Under Consideration",
        "completed_at": "Tomorrow, 11:00 AM",
        "scheduled_time": "Tomorrow, 11:00 AM",
        "skills": ["Docker", "Kubernetes", "Terraform", "AWS", "CI/CD"],
        "tab_switches": 0,
        "flags": [],
        "recording_url": None,
        "resume_text": "Rohan Verma. Systems & DevOps engineer focused on container orchestration, Infrastructure as Code using Terraform, and GitOps pipelines.",
        "organization": "default_org",
        "created_at": "2026-11-19T01:00:00Z",
        "updated_at": "2026-11-19T01:00:00Z",
        "avatar_bg": "bg-indigo-50 text-indigo-700",
        "initials": "RV",
        "report": None
    }
]


def get_public_app_url() -> str:
    """Return public application URL from environment or production fallback (never localhost in production)."""
    env_url = (os.getenv("PUBLIC_APP_URL") or os.getenv("APP_URL") or "").strip()
    if env_url:
        return env_url.rstrip("/")

    app_env = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).lower()
    is_prod = app_env in ("production", "prod") or bool(os.getenv("RENDER")) or bool(os.getenv("VERCEL"))
    if is_prod:
        return "https://ai-interview-agent-three-taupe.vercel.app"
    return "http://localhost:3000"


class CandidateService:
    """Service for candidate lifecycle & persistence operations"""

    def __init__(self):
        self.collection = get_collection(Collections.CANDIDATES)
        self._init_db()

    def _init_db(self):
        """Initialize indexes and seed default candidates if empty"""
        try:
            # Create indexes
            self.collection.create_index("status")
            self.collection.create_index("role")
            self.collection.create_index([("created_at", -1)])
            self.collection.create_index("organization")
            self.collection.create_index([("email", 1), ("role", 1)])
            
            # Seed default candidates if empty
            count = self.collection.count_documents({})
            if count == 0:
                logger.info("🌱 Seeding initial candidate dataset into database...")
                for c in INITIAL_SEED_CANDIDATES:
                    self.collection.insert_one(dict(c))
                logger.info(f"✅ Seeded {len(INITIAL_SEED_CANDIDATES)} candidates successfully.")
        except Exception as e:
            logger.warning(f"⚠️ Index/seed initialization note: {e}")

    def schedule_interview(
        self,
        candidate_name: str,
        candidate_email: str,
        role: str,
        job_description: Optional[str] = None,
        skills: Optional[List[str]] = None,
        resume_text: Optional[str] = None,
        resume_filename: Optional[str] = None,
        expires_in_hours: int = 48,
        is_demo: bool = False,
        organization: str = "default_org"
    ) -> Dict[str, Any]:
        """
        Schedule an interview with status 'Scheduled'.
        Generates a cryptographically secure random token (secrets.token_urlsafe(32)),
        hashes it with SHA-256, and stores ONLY the token hash in the database.
        The raw token is only returned to the caller to generate the candidate link.
        """
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=expires_in_hours)
        
        # Cryptographically secure random token (raw 32-byte urlsafe string)
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        interview_id = f"cand-{secrets.token_hex(4)}"
        initials = "".join([part[0] for part in candidate_name.split() if part])[:2].upper() or "CD"
        skills = skills or ["Problem Solving", "System Architecture", "Domain Competence"]
        public_url = get_public_app_url()
        full_interview_url = f"{public_url}/interview/{raw_token}"

        candidate_doc = {
            "id": interview_id,
            "interview_id": interview_id,
            "name": candidate_name.strip(),
            "email": candidate_email.strip().lower(),
            "role": role.strip(),
            "job_id": f"job-{role.lower().replace(' ', '-')[:12]}",
            "job_description": job_description or "",
            "interview_type": "AI Async",
            "status": "Scheduled",
            "score": 0,
            "verdict": "Scheduled",
            "flags": [],
            "tab_switches": 0,
            "started_at": None,
            "completed_at": None,
            "scheduled_time": now.strftime("%Y-%m-%d %H:%M UTC"),
            "recording_url": None,
            "report": None,
            "organization": organization,
            "skills": skills,
            "avatar_bg": "bg-sky-50 text-sky-700",
            "initials": initials,
            "resume_text": resume_text or f"Scheduled interview for {role}. Candidate: {candidate_name}.",
            "resume_filename": resume_filename,
            "conversation_history": [],
            "token_hash": token_hash,
            "expires_at": expires_at.isoformat(),
            "expires_in_hours": expires_in_hours,
            "is_used": False,
            "is_demo": is_demo,
            "email_status": "pending",
            "email_sent_at": None,
            "email_error": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        # Insert into candidates collection
        self.collection.insert_one(candidate_doc)

        # Also store invite in interview_invites collection for fast lookups
        try:
            invites_col = get_collection("interview_invites")
            invite_record = {
                "token_hash": token_hash,
                "candidate_id": interview_id,
                "candidate_name": candidate_name.strip(),
                "candidate_email": candidate_email.strip().lower(),
                "role": role.strip(),
                "job_description": job_description or "",
                "skills": skills,
                "resume_text": resume_text or "",
                "created_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "is_used": False,
                "status": "Scheduled",
                "is_demo": is_demo,
                "email_status": "pending",
                "email_sent_at": None,
                "email_error": None
            }
            invites_col.insert_one(invite_record)
        except Exception as e:
            logger.warning(f"Failed to record in interview_invites: {e}")

        logger.info(f"📅 Interview scheduled: {candidate_name} ({candidate_email}) - ID: {interview_id}")

        clean_candidate = dict(candidate_doc)
        clean_candidate.pop("_id", None)
        clean_candidate.pop("token_hash", None)

        return {
            "success": True,
            "token": raw_token,
            "interview_url": full_interview_url,
            "relative_url": f"/interview/{raw_token}",
            "expires_at": expires_at.isoformat(),
            "expires_in_hours": expires_in_hours,
            "candidate": clean_candidate
        }

    def update_email_status(
        self,
        candidate_identifier: str,
        status: str,
        sent_at: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Update candidate invitation email dispatch status and error telemetry.
        status: 'pending' | 'sent' | 'failed'
        """
        if not candidate_identifier:
            return False

        now_str = datetime.utcnow().isoformat()
        update_fields: Dict[str, Any] = {
            "email_status": status,
            "updated_at": now_str
        }
        if status == "sent":
            update_fields["email_sent_at"] = sent_at or now_str
            update_fields["email_error"] = None
        elif status == "failed":
            update_fields["email_error"] = error_message or "Email dispatch failed"

        result = self.collection.update_many(
            {
                "$or": [
                    {"id": candidate_identifier},
                    {"email": candidate_identifier.lower().strip()},
                    {"interview_id": candidate_identifier}
                ]
            },
            {"$set": update_fields}
        )

        try:
            invites_col = get_collection("interview_invites")
            invites_col.update_many(
                {
                    "$or": [
                        {"candidate_id": candidate_identifier},
                        {"candidate_email": candidate_identifier.lower().strip()}
                    ]
                },
                {"$set": update_fields}
            )
        except Exception:
            pass

        return result.modified_count > 0

    def validate_interview_token(self, raw_token: str) -> Dict[str, Any]:
        """
        Validate single-use interview token:
        - Rejects legacy/weak tokens (< 32 characters entropy)
        - Computes SHA-256 hash of raw_token
        - Compares hashes in constant time using hmac.compare_digest
        - Verifies existence, expiration, cancellation, and single-use status
        - Returns read-only candidate data without scores or evaluation
        """
        if not raw_token or not raw_token.strip():
            return {
                "valid": False,
                "reason": "missing",
                "message": "Please open the interview link sent by your recruiter."
            }

        token_clean = raw_token.strip()
        # Invalidate/reject weak or legacy tokens (< 32 chars of entropy)
        if len(token_clean) < 32:
            return {
                "valid": False,
                "reason": "invalid_or_legacy",
                "message": "This interview link is no longer valid or uses an outdated format. Please request a new invitation from your recruiter."
            }

        token_hash = hashlib.sha256(token_clean.encode("utf-8")).hexdigest()

        # Find in collection by token_hash
        candidate = self.collection.find_one({"token_hash": token_hash})

        if not candidate:
            try:
                invites_col = get_collection("interview_invites")
                inv = invites_col.find_one({"token_hash": token_hash})
                if inv:
                    cand_id = inv.get("candidate_id")
                    candidate = self.collection.find_one({"id": cand_id}) if cand_id else inv
            except Exception:
                pass

        if not candidate:
            return {
                "valid": False,
                "reason": "not_found",
                "message": "Invalid or unrecognized interview link. Please verify your invitation URL."
            }

        # Constant-time comparison for security
        stored_hash = candidate.get("token_hash", "")
        if not hmac.compare_digest(stored_hash, token_hash):
            return {
                "valid": False,
                "reason": "not_found",
                "message": "Invalid interview token authentication."
            }

        # Check status
        status = candidate.get("status", "Scheduled")
        if status == "Cancelled":
            return {
                "valid": False,
                "reason": "cancelled",
                "message": "This interview invitation has been cancelled by the recruiter."
            }

        if candidate.get("is_used") or status == "Completed":
            return {
                "valid": False,
                "reason": "completed",
                "message": "This interview has already been completed. Single-use links cannot be retaken."
            }

        # Check expiration
        expires_at_str = candidate.get("expires_at")
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str)
                if datetime.utcnow() > expires_at:
                    return {
                        "valid": False,
                        "reason": "expired",
                        "message": "This interview invitation link has expired. Please contact your recruiter for a new link."
                    }
            except Exception:
                pass

        # Return safe read-only payload (NO scores, NO evaluation, NO token_hash)
        return {
            "valid": True,
            "candidate": {
                "id": candidate.get("id"),
                "name": candidate.get("name"),
                "email": candidate.get("email"),
                "role": candidate.get("role"),
                "job_description": candidate.get("job_description", ""),
                "skills": candidate.get("skills", []),
                "resume_text": candidate.get("resume_text", ""),
                "expires_at": candidate.get("expires_at"),
                "status": candidate.get("status", "Scheduled"),
                "is_demo": candidate.get("is_demo", False)
            }
        }

    def start_interview_by_token(self, raw_token: str) -> Dict[str, Any]:
        """Mark interview as In Progress upon candidate device consent and start."""
        val = self.validate_interview_token(raw_token)
        if not val["valid"]:
            return val

        cand_info = val["candidate"]
        cand_id = cand_info["id"]
        now_str = datetime.utcnow().isoformat()

        self.collection.update_one(
            {"id": cand_id},
            {"$set": {"status": "In Progress", "started_at": now_str, "updated_at": now_str}}
        )
        return {"success": True, "status": "In Progress", "candidate": cand_info}

    def complete_interview_by_token(self, raw_token: str) -> Dict[str, Any]:
        """Mark interview as Completed upon completion, locking the link."""
        token_hash = hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()
        now_str = datetime.utcnow().isoformat()

        self.collection.update_one(
            {"$or": [{"token_hash": token_hash}, {"token": raw_token.strip()}, {"id": raw_token.strip()}]},
            {"$set": {"status": "Completed", "is_used": True, "completed_at": now_str, "updated_at": now_str}}
        )
        return {"success": True, "status": "Completed"}

    def extend_interview_expiry(self, candidate_id: str, additional_hours: int = 48) -> Dict[str, Any]:
        """Extend expiry of a scheduled interview."""
        cand = self.collection.find_one({"id": candidate_id})
        if not cand:
            return {"success": False, "error": "Candidate not found"}

        now = datetime.utcnow()
        try:
            current_expires = datetime.fromisoformat(cand.get("expires_at"))
            base_time = max(now, current_expires)
        except Exception:
            base_time = now

        new_expires = base_time + timedelta(hours=additional_hours)
        self.collection.update_one(
            {"id": candidate_id},
            {"$set": {"expires_at": new_expires.isoformat(), "updated_at": now.isoformat()}}
        )
        return {"success": True, "new_expires_at": new_expires.isoformat()}

    def cancel_interview(self, candidate_id: str) -> Dict[str, Any]:
        """Cancel a scheduled interview."""
        now_str = datetime.utcnow().isoformat()
        self.collection.update_one(
            {"id": candidate_id},
            {"$set": {"status": "Cancelled", "updated_at": now_str}}
        )
        return {"success": True, "status": "Cancelled"}

    def start_or_resume_session(
        self,
        interview_id: str,
        candidate_name: str,
        candidate_email: str,
        job_title: str,
        job_id: Optional[str] = None,
        skills: Optional[List[str]] = None,
        resume_text: Optional[str] = None,
        organization: str = "default_org",
        interview_type: str = "AI Async"
    ) -> Dict[str, Any]:
        """
        Create or update candidate session immediately on interview start.
        Prevents duplicate candidates by matching email and role.
        """
        now_str = datetime.utcnow().isoformat()
        skills = skills or ["Full Stack", "Problem Solving", "System Architecture"]
        role = job_title.strip() if job_title else "Full Stack Developer"
        email = candidate_email.strip() if candidate_email else "candidate@example.com"
        name = candidate_name.strip() if candidate_name else "Candidate"
        
        # Check if candidate exists for this email & role
        existing = self.collection.find_one({
            "email": email,
            "role": role
        })

        if existing:
            # Update existing candidate record with the active interview session
            update_data = {
                "id": interview_id,
                "name": name,
                "status": "In Progress",
                "interview_type": interview_type,
                "started_at": now_str,
                "updated_at": now_str,
                "organization": organization
            }
            if resume_text:
                update_data["resume_text"] = resume_text
            if skills:
                update_data["skills"] = skills

            self.collection.update_one(
                {"_id": existing.get("_id") or existing.get("id")},
                {"$set": update_data}
            )
            logger.info(f"🔄 Candidate session updated: {email} -> In Progress (ID: {interview_id})")
            existing.update(update_data)
            return existing

        # Create new candidate record
        initials = "".join([part[0] for part in name.split() if part])[:2].upper() or "CD"
        new_candidate = {
            "id": interview_id,
            "name": name,
            "email": email,
            "role": role,
            "job_id": job_id or f"job-{role.lower().replace(' ', '-')[:12]}",
            "interview_type": interview_type,
            "status": "In Progress",
            "score": 0,
            "verdict": "Under Consideration",
            "flags": [],
            "tab_switches": 0,
            "started_at": now_str,
            "completed_at": None,
            "scheduled_time": None,
            "recording_url": None,
            "report": None,
            "organization": organization,
            "skills": skills,
            "avatar_bg": "bg-[var(--primary-soft)] text-[var(--primary)]",
            "initials": initials,
            "resume_text": resume_text or f"Interview session for {role}. Candidate: {name}.",
            "conversation_history": [],
            "created_at": now_str,
            "updated_at": now_str
        }

        self.collection.insert_one(new_candidate)
        logger.info(f"✨ New candidate created: {name} ({email}) -> In Progress (ID: {interview_id})")
        return new_candidate

    def save_screened_candidate(
        self,
        name: str,
        email: str,
        role: str,
        score: float,
        skills: Optional[List[str]] = None,
        resume_text: str = "",
        strengths: Optional[List[str]] = None,
        improvement_areas: Optional[List[str]] = None,
        status: str = "Screened",
        organization: str = "default_org"
    ) -> Dict[str, Any]:
        """
        Persist an AI-screened candidate to database so they immediately appear
        in the Recruiter Dashboard candidates list with score, skills, and report.
        """
        now_str = datetime.utcnow().isoformat()
        clean_name = name.strip() if name and name.strip() and name.strip() != "Name not found" else f"Candidate {uuid.uuid4().hex[:4].upper()}"
        clean_email = email.strip() if email and email.strip() and email.strip() != "Email not found" else f"{clean_name.lower().replace(' ', '.')}@applicant.net"
        clean_skills = skills if skills and len(skills) > 0 else ["Software Engineering", "Problem Solving"]
        int_score = int(round(score))

        # Check if already exists for this email and role to avoid duplicate spam
        existing = self.collection.find_one({
            "email": clean_email,
            "role": role
        })

        initials = "".join([part[0] for part in clean_name.split() if part])[:2].upper() or "CD"
        verdict = "Recommended" if int_score >= 75 else ("Under Consideration" if int_score >= 50 else "Review Needed")

        report_payload = {
            "recommendation": verdict,
            "scores": {
                "overall": int_score,
                "technical": int_score,
                "problem_solving": int_score,
                "communication": 75,
                "cultural_fit": 75
            },
            "summary": f"Automated AI resume screening for {role}. Candidate match score: {int_score}%.",
            "key_strengths": strengths or ["Profile matches core target requirements"],
            "areas_for_improvement": improvement_areas or ["Live technical and architecture evaluation recommended"],
            "interview_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "duration_minutes": 0,
            "total_questions": 0
        }

        if existing:
            update_data = {
                "name": clean_name,
                "score": int_score,
                "verdict": verdict,
                "skills": clean_skills,
                "resume_text": resume_text or existing.get("resume_text", ""),
                "report": report_payload,
                "status": status,
                "updated_at": now_str
            }
            self.collection.update_one({"_id": existing["_id"]}, {"$set": update_data})
            existing.update(update_data)
            logger.info(f"🔄 Updated screened candidate: {clean_name} ({clean_email}) - Score: {int_score}")
            return existing

        cand_id = f"cand-{uuid.uuid4().hex[:8]}"
        new_doc = {
            "id": cand_id,
            "name": clean_name,
            "email": clean_email,
            "role": role,
            "job_id": f"job-{role.lower().replace(' ', '-')[:10]}",
            "interview_type": "AI Async",
            "status": status,
            "score": int_score,
            "verdict": verdict,
            "completed_at": "Just now",
            "scheduled_time": None,
            "skills": clean_skills,
            "tab_switches": 0,
            "flags": [],
            "recording_url": None,
            "resume_text": resume_text,
            "organization": organization,
            "created_at": now_str,
            "updated_at": now_str,
            "avatar_bg": "bg-blue-50 text-blue-700",
            "initials": initials,
            "report": report_payload
        }
        self.collection.insert_one(new_doc)
        logger.info(f"✨ Screened candidate added to database: {clean_name} ({clean_email}) - Score: {int_score}")
        return new_doc

    def record_answer_turn(
        self,
        interview_id: str,
        question_number: int,
        question_text: str,
        answer_text: str,
        evaluation: Optional[Dict[str, Any]] = None,
        difficulty: str = "medium",
        topic: str = "",
        latency: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Persist candidate's answer and evaluation turn (idempotent, upsert)
        Includes score, feedback, strengths, gaps, difficulty, topic, latency for recruiter report.
        """
        eval_data = evaluation or {}
        score = eval_data.get("score_0_10")
        if score is None:
            score = eval_data.get("overall_score", 0.0)
        feedback = eval_data.get("feedback", "")
        strengths = eval_data.get("strengths", [])
        gaps = eval_data.get("gaps") or eval_data.get("weaknesses") or []

        turn = {
            "question_number": question_number,
            "question": question_text,
            "answer": answer_text,
            "score": score,
            "feedback": feedback,
            "strengths": strengths,
            "gaps": gaps,
            "difficulty": difficulty,
            "topic": topic,
            "evaluation": eval_data,
            "latency": latency or {},
            "timestamp": datetime.utcnow().isoformat()
        }

        # Find candidate
        candidate = self.collection.find_one({"id": interview_id})
        if not candidate:
            return False

        history = candidate.get("conversation_history", [])
        if not isinstance(history, list):
            history = []

        # Replace existing turn if same question_number or append
        updated_history = [h for h in history if h.get("question_number") != question_number]
        updated_history.append(turn)

        self.collection.update_one(
            {"id": interview_id},
            {
                "$set": {
                    "conversation_history": updated_history,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        return True

    def complete_session(
        self,
        interview_id: str,
        score: float,
        report: Optional[Dict[str, Any]] = None,
        verdict: Optional[str] = None,
        flags: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Finalize interview session, save final report, score, verdict and status.
        Status is set to Completed (or Pending Review if integrity flags exist).
        """
        candidate = self.collection.find_one({"id": interview_id})
        if not candidate:
            logger.warning(f"⚠️ Interview {interview_id} not found in DB when completing.")
            return None

        now_str = datetime.utcnow().isoformat()
        resolved_score = round(float(score or 0))

        # Check existing flags + new flags
        existing_flags = candidate.get("flags", [])
        if not isinstance(existing_flags, list):
            existing_flags = []
        if flags and isinstance(flags, list):
            existing_flags.extend(flags)

        # Determine verdict if not provided
        if not verdict:
            if existing_flags and len(existing_flags) > 0:
                verdict = "Review Needed"
            elif resolved_score >= 85:
                verdict = "Strong Hire"
            elif resolved_score >= 75:
                verdict = "Recommended"
            elif resolved_score >= 60:
                verdict = "Under Consideration"
            else:
                verdict = "Not Recommended"

        # Determine final status
        status = "Pending Review" if (existing_flags and len(existing_flags) > 0) else "Completed"

        update_payload = {
            "status": status,
            "score": resolved_score,
            "verdict": verdict,
            "flags": existing_flags,
            "report": report or {},
            "completed_at": now_str,
            "updated_at": now_str
        }

        # Atomic update with retry
        for attempt in range(3):
            try:
                res = self.collection.update_one(
                    {"id": interview_id},
                    {"$set": update_payload}
                )
                if res.modified_count > 0 or res.matched_count > 0:
                    logger.info(f"🎉 Candidate {interview_id} successfully marked as {status} (Score: {resolved_score})")
                    candidate.update(update_payload)
                    return candidate
            except Exception as e:
                logger.error(f"Attempt {attempt+1} failed updating completed interview {interview_id}: {e}")

        return candidate

    def list_candidates(
        self,
        role: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        sort_field: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 10,
        organization: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List candidates with server-side filters, search, sorting, pagination,
        and dynamically computed tab counts (BEFORE applying status filter).
        """
        # Fetch candidates matching base organization filter (strictly exclude demo sessions from recruiter pipeline)
        all_docs = list(self.collection.find({}))
        all_docs = [c for c in all_docs if not c.get("is_demo")]
        
        # 1. Base filter by organization if specified
        if organization and organization != "all":
            all_docs = [c for c in all_docs if c.get("organization") == organization or not c.get("organization")]

        # 2. Filter by Role (if provided and not "all" / "All Roles")
        if role and role.lower() not in ["all", "all roles"]:
            clean_role = role.strip().lower()
            all_docs = [c for c in all_docs if clean_role in c.get("role", "").lower()]

        # 3. Filter by Search Query (combined with role using AND logic)
        if search and search.strip():
            sq = search.strip().lower()
            all_docs = [
                c for c in all_docs
                if sq in c.get("name", "").lower()
                or sq in c.get("email", "").lower()
                or sq in c.get("role", "").lower()
                or any(sq in skill.lower() for skill in c.get("skills", []))
            ]

        # 4. Compute statusCounts AFTER applying role & search, but BEFORE applying status tab
        status_counts = {
            "all": len(all_docs),
            "completed": 0,
            "inProgress": 0,
            "pendingReview": 0,
            "scheduled": 0,
            "shortlisted": 0,
            "rejected": 0
        }

        for c in all_docs:
            st = c.get("status", "")
            if st == "Completed":
                status_counts["completed"] += 1
            elif st in ["In Progress", "Live Video"]:
                status_counts["inProgress"] += 1
            elif st == "Pending Review":
                status_counts["pendingReview"] += 1
            elif st in ["Scheduled", "Screened"]:
                status_counts["scheduled"] += 1
            elif st == "Shortlisted":
                status_counts["shortlisted"] += 1
            elif st == "Rejected":
                status_counts["rejected"] += 1

        # 5. Apply Status Tab filter
        filtered_docs = all_docs
        if status and status.lower() not in ["all", "all candidates"]:
            clean_status = status.strip().lower()
            if clean_status in ["in progress", "in-progress", "live video"]:
                filtered_docs = [c for c in filtered_docs if c.get("status") in ["In Progress", "Live Video"]]
            elif clean_status in ["scheduled", "screened"]:
                filtered_docs = [c for c in filtered_docs if c.get("status") in ["Scheduled", "Screened"]]
            else:
                filtered_docs = [c for c in filtered_docs if c.get("status", "").lower() == clean_status]

        # 6. Sorting
        reverse_sort = (sort_order.lower() == "desc")
        
        def sort_key(c: Dict[str, Any]):
            if sort_field == "score":
                return c.get("score", 0)
            elif sort_field in ["date", "completed_at", "created_at"]:
                return c.get("created_at") or c.get("completed_at") or ""
            elif sort_field == "name":
                return c.get("name", "").lower()
            elif sort_field == "role":
                return c.get("role", "").lower()
            return c.get("created_at") or ""

        filtered_docs.sort(key=sort_key, reverse=reverse_sort)

        # 7. Pagination
        total = len(filtered_docs)
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        total_pages = max(1, math.ceil(total / page_size))
        
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_candidates = filtered_docs[start_idx:end_idx]

        # Clean output documents
        clean_paged = []
        for c in paged_candidates:
            cd = dict(c)
            if "_id" in cd:
                cd["_id"] = str(cd["_id"])
            clean_paged.append(cd)

        return {
            "candidates": clean_paged,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "statusCounts": status_counts
        }

    def get_candidate_by_id(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Get candidate by id or _id"""
        candidate = self.collection.find_one({"id": candidate_id})
        if not candidate:
            candidate = self.collection.find_one({"_id": candidate_id})
        if candidate:
            candidate["_id"] = str(candidate["_id"])
        return candidate

    def reject_candidates(self, candidate_ids: List[str], reason: str = "Bulk rejection") -> Tuple[int, List[str]]:
        """Reject candidates in bulk"""
        now_str = datetime.utcnow().isoformat()
        rejected = []
        for cid in candidate_ids:
            res = self.collection.update_one(
                {"id": cid},
                {"$set": {"status": "Rejected", "rejection_reason": reason, "updated_at": now_str}}
            )
            if res.matched_count == 0:
                res = self.collection.update_one(
                    {"_id": cid},
                    {"$set": {"status": "Rejected", "rejection_reason": reason, "updated_at": now_str}}
                )
            if res.matched_count > 0 or res.modified_count > 0:
                rejected.append(cid)
        return len(rejected), rejected

    def undo_reject(self, restorations: Dict[str, str]) -> int:
        """Restore previous candidate statuses"""
        now_str = datetime.utcnow().isoformat()
        restored = 0
        for cid, prev_status in restorations.items():
            res = self.collection.update_one(
                {"id": cid},
                {"$set": {"status": prev_status, "updated_at": now_str}}
            )
            if res.matched_count == 0:
                res = self.collection.update_one(
                    {"_id": cid},
                    {"$set": {"status": prev_status, "updated_at": now_str}}
                )
            if res.matched_count > 0 or res.modified_count > 0:
                restored += 1
        return restored

    def shortlist_candidates(self, candidate_ids: List[str]) -> Tuple[int, List[str]]:
        """Shortlist candidates in bulk"""
        now_str = datetime.utcnow().isoformat()
        shortlisted = []
        for cid in candidate_ids:
            res = self.collection.update_one(
                {"id": cid},
                {"$set": {"status": "Shortlisted", "updated_at": now_str}}
            )
            if res.matched_count == 0:
                res = self.collection.update_one(
                    {"_id": cid},
                    {"$set": {"status": "Shortlisted", "updated_at": now_str}}
                )
            if res.matched_count > 0 or res.modified_count > 0:
                shortlisted.append(cid)
        return len(shortlisted), shortlisted

    def get_db_health(self) -> Dict[str, Any]:
        """Check database health and candidate distribution"""
        client = get_mongo_client()
        stats = client.get_stats()
        is_alive = client.ping()

        candidates = list(self.collection.find({}))
        counts = {
            "total": len(candidates),
            "completed": sum(1 for c in candidates if c.get("status") == "Completed"),
            "in_progress": sum(1 for c in candidates if c.get("status") in ["In Progress", "Live Video"]),
            "pending_review": sum(1 for c in candidates if c.get("status") == "Pending Review"),
            "scheduled": sum(1 for c in candidates if c.get("status") in ["Scheduled", "Screened"]),
            "shortlisted": sum(1 for c in candidates if c.get("status") == "Shortlisted"),
            "rejected": sum(1 for c in candidates if c.get("status") == "Rejected"),
        }

        return {
            "status": "healthy" if (is_alive or stats.get("mode") == "resilient_store") else "degraded",
            "connected": is_alive,
            "mode": stats.get("mode", "resilient_store"),
            "database": stats.get("database", "ai_recruiter"),
            "counts": counts,
            "timestamp": datetime.utcnow().isoformat()
        }


# Singleton candidate service instance
_candidate_service: Optional[CandidateService] = None

def get_candidate_service() -> CandidateService:
    global _candidate_service
    if _candidate_service is None:
        _candidate_service = CandidateService()
    return _candidate_service
