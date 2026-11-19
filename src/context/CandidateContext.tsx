/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { API_ENDPOINTS } from "@/config/api";

export type CandidateStatus =
  | "Scheduled"
  | "In Progress"
  | "Pending Review"
  | "Completed"
  | "Shortlisted"
  | "Rejected"
  | "Live Video"
  | "Screened";

export type FlagType = "tab switch" | "face not visible" | "multiple people" | "long silence";

export interface CandidateFlag {
  type: FlagType;
  reason: string;
  time: string;
}

export interface CandidateRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  type: "AI Async" | "Live Video";
  status: CandidateStatus;
  score: number;
  completedAt: string;
  progress?: string;
  skills: string[];
  avatarUrl?: string;
  avatarBg?: string;
  initials?: string;
  tabSwitches?: number;
  flags?: CandidateFlag[];
  recordingUrl?: string;
  scheduledTime?: string;
  resumeText?: string;
  report?: Record<string, unknown>;
}

export interface CandidateCounts {
  all: number;
  completed: number;
  inProgress: number;
  pendingReview: number;
  scheduled: number;
  shortlisted: number;
  rejected: number;
}

interface CandidateContextType {
  candidates: CandidateRecord[];
  counts: CandidateCounts;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshCandidates: () => Promise<void>;
  setCandidates: React.Dispatch<React.SetStateAction<CandidateRecord[]>>;
  updateCandidateStatus: (id: string, newStatus: CandidateStatus) => void;
  shortlistSelected: (selectedIds: string[]) => Promise<{ eligibleCount: number; skippedCount: number }>;
  rejectSelected: (selectedIds: string[], reason?: string) => Promise<{ success: boolean; restorations?: Record<string, CandidateStatus> }>;
  undoReject: (restorations: Record<string, CandidateStatus>) => Promise<boolean>;
  exportSelectedCSV: (selectedIds: string[]) => void;
}

const STORAGE_KEY = "ai_interview_candidates_v4";

// Golden Demo seed candidates data with structured proctoring flags and full reports
export const INITIAL_CANDIDATES_SEED: CandidateRecord[] = [
  {
    id: "cand-1",
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    role: "Senior Frontend Engineer",
    type: "AI Async",
    status: "Shortlisted",
    score: 88,
    completedAt: "Today, 10:30 AM",
    skills: ["React", "TypeScript", "Next.js", "State Architecture", "Tailwind CSS"],
    avatarBg: "bg-emerald-50 text-emerald-700",
    initials: "AS",
    tabSwitches: 0,
    flags: [], // Clean integrity record - no proctoring flags
    recordingUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    resumeText: "Aarav Sharma. 5+ years experience building large-scale frontend applications, component design systems, and state architectures using React and TypeScript.",
    report: {
      recommendation: "Recommended",
      scores: {
        overall: 88,
        technical: 91,
        problem_solving: 86,
        communication: 89,
        cultural_fit: 85
      },
      summary: "Candidate demonstrated exceptional mastery of React architecture, concurrent rendering, and custom hooks. Articulated trade-offs with high verbal clarity and precision.",
      key_strengths: [
        "Deep knowledge of React concurrent rendering and state architecture",
        "Strong TypeScript typing hygiene and interface contracts",
        "Clear system-level trade-off analysis during technical questioning"
      ],
      areas_for_improvement: [
        "Could explore WebAssembly optimizations for client-side compute-heavy workloads",
        "Deepen familiarity with edge middleware caching strategies"
      ],
      interview_date: "11/19/2026",
      duration_minutes: 18,
      total_questions: 8
    }
  },
  {
    id: "cand-2",
    name: "Priya Mehta",
    email: "priya.m@techstudio.dev",
    role: "Full Stack Engineer",
    type: "AI Async",
    status: "Completed",
    score: 76,
    completedAt: "Today, 09:15 AM",
    skills: ["Java", "Spring Boot", "Angular", "PostgreSQL", "REST APIs"],
    avatarBg: "bg-blue-50 text-blue-700",
    initials: "PM",
    tabSwitches: 0,
    flags: [], // Clean integrity record - no proctoring flags
    recordingUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    resumeText: "Priya Mehta. Full Stack Engineer with 4 years building enterprise applications using Spring Boot microservices, Angular frontend, and relational databases.",
    report: {
      recommendation: "Recommended",
      scores: {
        overall: 76,
        technical: 78,
        problem_solving: 75,
        communication: 76,
        cultural_fit: 75
      },
      summary: "Solid backend fundamentals in Spring Boot REST controllers, ORM entity mappings, and relational database indexing. Good foundational knowledge of Angular component lifecycle.",
      key_strengths: [
        "Strong understanding of PostgreSQL indexing and query joins",
        "Proficient in Spring Boot dependency injection and modular service layering",
        "Clear verbal articulation on API contract design"
      ],
      areas_for_improvement: [
        "Could deepen familiarity with microservice resilience patterns (e.g. circuit breakers, Kafka retries)",
        "Expand on Angular state management patterns (Signals / NgRx)"
      ],
      interview_date: "11/19/2026",
      duration_minutes: 15,
      total_questions: 8
    }
  },
  {
    id: "cand-3",
    name: "Kabir Malhotra",
    email: "kabir.m@neural.network",
    role: "Backend Systems Engineer",
    type: "AI Async",
    status: "Pending Review",
    score: 72,
    completedAt: "Yesterday, 04:30 PM",
    skills: ["Node.js", "Python", "PostgreSQL", "Redis", "Distributed Systems"],
    avatarBg: "bg-amber-50 text-amber-700",
    initials: "KM",
    tabSwitches: 1,
    flags: [
      {
        type: "long silence",
        reason: "Extended silence detected before answering technical architecture prompt",
        time: "Yesterday, 04:38 PM"
      }
    ],
    recordingUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    resumeText: "Kabir Malhotra. Backend engineer focused on high-throughput asynchronous services, caching topologies, and PostgreSQL optimizations.",
    report: {
      recommendation: "Under Consideration",
      scores: {
        overall: 72,
        technical: 74,
        problem_solving: 70,
        communication: 71,
        cultural_fit: 73
      },
      summary: "Good grasp of Node.js event loop, asynchronous IO, and Redis caching layers. Took notable hesitation on distributed locking and consensus protocols, requiring manual reviewer sign-off.",
      key_strengths: [
        "Practical understanding of Redis key eviction and caching strategies",
        "Clean schema design for relational databases",
        "Honest self-awareness about edge-case limitations"
      ],
      areas_for_improvement: [
        "Distributed transactions (2PC / Saga pattern)",
        "Confidence during unscripted system scaling scenarios"
      ],
      interview_date: "11/18/2026",
      duration_minutes: 16,
      total_questions: 8
    }
  },
  {
    id: "cand-4",
    name: "Ananya Singh",
    email: "ananya.s@analytics.org",
    role: "Machine Learning Engineer",
    type: "AI Async",
    status: "Shortlisted",
    score: 92,
    completedAt: "Yesterday, 11:20 AM",
    skills: ["Python", "PyTorch", "Transformers", "FastAPI", "Vector DBs"],
    avatarBg: "bg-purple-50 text-purple-700",
    initials: "AS",
    tabSwitches: 0,
    flags: [],
    recordingUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    resumeText: "Ananya Singh. ML Engineer specializing in generative AI workflows, RAG architectures, model quantization, and production inference serving.",
    report: {
      recommendation: "Recommended",
      scores: {
        overall: 92,
        technical: 95,
        problem_solving: 92,
        communication: 90,
        cultural_fit: 91
      },
      summary: "Exceptional performance. Articulated fine-tuning vs RAG trade-offs, vector similarity search indexes (HNSW, IVFFlat), and quantization strategies (LoRA, QLoRA) with stellar technical precision.",
      key_strengths: [
        "Command over LLM deployment pipelines and latency optimization",
        "Rigorous statistical and mathematical foundation",
        "Concise, articulate verbal explanations with real production insights"
      ],
      areas_for_improvement: [
        "Could gain more experience with multi-modal tensor streaming architectures"
      ],
      interview_date: "11/18/2026",
      duration_minutes: 20,
      total_questions: 8
    }
  },
  {
    id: "cand-5",
    name: "Devina Roy",
    email: "devina.roy@cloudsystems.net",
    role: "Data Engineer",
    type: "AI Async",
    status: "Completed",
    score: 81,
    completedAt: "2 days ago",
    skills: ["Apache Spark", "SQL", "Airflow", "Kafka", "Snowflake"],
    avatarBg: "bg-cyan-50 text-cyan-700",
    initials: "DR",
    tabSwitches: 0,
    flags: [],
    recordingUrl: undefined,
    resumeText: "Devina Roy. Data Engineer with 4+ years designing high-volume data pipelines, real-time Kafka event streaming, and analytical warehouses.",
    report: {
      recommendation: "Recommended",
      scores: {
        overall: 81,
        technical: 83,
        problem_solving: 80,
        communication: 82,
        cultural_fit: 79
      },
      summary: "Strong experience in designing resilient ETL/ELT pipelines, streaming data ingestion using Kafka, and batch transformations using PySpark.",
      key_strengths: [
        "Deep knowledge of data warehouse partitioning and clustering",
        "Robust DAG construction and dependency management in Airflow"
      ],
      areas_for_improvement: [
        "Expand on modern Iceberg/Delta Lake ACID transaction semantics"
      ],
      interview_date: "11/17/2026",
      duration_minutes: 16,
      total_questions: 8
    }
  },
  {
    id: "cand-6",
    name: "Rohan Verma",
    email: "rohan.v@cloudscale.io",
    role: "Cloud & DevOps Engineer",
    type: "Live Video",
    status: "Scheduled",
    score: 0,
    completedAt: "Tomorrow, 11:00 AM",
    scheduledTime: "Tomorrow, 11:00 AM",
    skills: ["Docker", "Kubernetes", "Terraform", "AWS", "CI/CD"],
    avatarBg: "bg-indigo-50 text-indigo-700",
    initials: "RV",
    tabSwitches: 0,
    flags: [],
    resumeText: "Rohan Verma. Systems & DevOps engineer focused on container orchestration, Infrastructure as Code using Terraform, and GitOps pipelines."
  }
];

// Helper to normalize any legacy string flags from localStorage to structured CandidateFlag
export function normalizeFlags(flags?: unknown[]): CandidateFlag[] {
  if (!Array.isArray(flags)) return [];
  return flags.map(item => {
    if (typeof item === "string") {
      const lower = item.toLowerCase();
      let type: FlagType = "tab switch";
      if (lower.includes("face") || lower.includes("visible")) type = "face not visible";
      else if (lower.includes("multiple") || lower.includes("people") || lower.includes("voice")) type = "multiple people";
      else if (lower.includes("silence") || lower.includes("focus") || lower.includes("lost")) type = "long silence";
      return { type, reason: item, time: "10:15 AM" };
    }
    return item as CandidateFlag;
  });
}

const CandidateContext = createContext<CandidateContextType | null>(null);

export const CandidateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [candidates, setCandidates] = useState<CandidateRecord[]>(() => {
    if (typeof window === "undefined") return INITIAL_CANDIDATES_SEED;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("ai_interview_candidates");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: CandidateRecord) => ({
            ...c,
            flags: normalizeFlags(c.flags)
          }));
        }
      }
    } catch (e) {
      console.warn("Failed to read candidates from localStorage, using seed:", e);
    }
    return INITIAL_CANDIDATES_SEED;
  });

  // Fetch candidates from FastAPI backend (Single Source of Truth)
  const refreshCandidates = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.candidates}?page=1&page_size=100`, {
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data && Array.isArray(json.data.candidates)) {
          const mapped: CandidateRecord[] = json.data.candidates.map((c: Record<string, unknown>) => ({
            id: String(c.id || c._id || ""),
            name: String(c.name || "Candidate"),
            email: String(c.email || ""),
            role: String(c.role || "Full Stack Developer"),
            type: (c.interview_type || c.type || "AI Async") as "AI Async" | "Live Video",
            status: (c.status || "In Progress") as CandidateStatus,
            score: typeof c.score === "number" ? c.score : 0,
            completedAt: c.completed_at || (c.status === "In Progress" ? "In Progress" : "Recently"),
            scheduledTime: c.scheduled_time,
            skills: Array.isArray(c.skills)
              ? (c.skills as string[])
              : typeof c.skills === "string"
              ? (c.skills as string).split(/\s+/)
              : ["Problem Solving"],
            flags: normalizeFlags(Array.isArray(c.flags) ? (c.flags as unknown[]) : []),
            tabSwitches: typeof c.tab_switches === "number" ? c.tab_switches : typeof c.tabSwitches === "number" ? c.tabSwitches : 0,
            recordingUrl: (c.recording_url || c.recordingUrl) as string | undefined,
            resumeText: (c.resume_text || c.resumeText) as string | undefined,
            avatarBg: (c.avatar_bg || c.avatarBg || "bg-[var(--primary-soft)] text-[var(--primary)]") as string,
            initials: (c.initials as string) || (typeof c.name === "string" ? c.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : "CD"),
            report: c.report as Record<string, unknown> | undefined
          }));

          setCandidates(mapped);
          setLastUpdated(new Date());
          setError(null);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
              localStorage.setItem("ai_interview_candidates", JSON.stringify(mapped));
            } catch (e) {
              // ignore quota
            }
          }
          setIsLoading(false);
          return;
        }
      }
      throw new Error(`Server returned HTTP ${response.status}`);
    } catch (err: unknown) {
      console.warn("Could not load /api/candidates from backend, using cached state:", err);
      // Fallback to cache or seed
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("ai_interview_candidates");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCandidates(parsed.map((c: CandidateRecord) => ({
                ...c,
                flags: normalizeFlags(c.flags)
              })));
              setIsLoading(false);
              return;
            }
          } catch (e) {
            // ignore
          }
        }
      }
      setCandidates(INITIAL_CANDIDATES_SEED);
      setError("Working with offline cached candidate data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
        localStorage.setItem("ai_interview_candidates", JSON.stringify(candidates));
      } catch (e) {
        console.warn("Failed to persist candidates:", e);
      }
    }
  }, [candidates]);

  // Initial load, periodic 15s polling, and window focus refetch
  useEffect(() => {
    refreshCandidates();
    const interval = setInterval(() => {
      refreshCandidates();
    }, 15000);

    const onRefetchNeeded = () => {
      refreshCandidates();
    };

    window.addEventListener("focus", onRefetchNeeded);
    window.addEventListener("interview-completed", onRefetchNeeded);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onRefetchNeeded);
      window.removeEventListener("interview-completed", onRefetchNeeded);
    };
  }, [refreshCandidates]);

  // Derived counts for tabs and sidebar
  const counts = useMemo<CandidateCounts>(() => {
    let completed = 0;
    let inProgress = 0;
    let pendingReview = 0;
    let scheduled = 0;
    let shortlisted = 0;
    let rejected = 0;

    for (const c of candidates) {
      if (c.status === "Completed") completed++;
      else if (c.status === "In Progress" || c.status === "Live Video") inProgress++;
      else if (c.status === "Pending Review") pendingReview++;
      else if (c.status === "Scheduled" || c.status === "Screened") scheduled++;
      else if (c.status === "Shortlisted") shortlisted++;
      else if (c.status === "Rejected") rejected++;
    }

    return {
      all: candidates.length,
      completed,
      inProgress,
      pendingReview,
      scheduled,
      shortlisted,
      rejected
    };
  }, [candidates]);

  // Update a single candidate's status
  const updateCandidateStatus = (id: string, newStatus: CandidateStatus) => {
    setCandidates(prev =>
      prev.map(c => (c.id === id ? { ...c, status: newStatus } : c))
    );
  };

  // Requirement 2: Shortlist Selected
  // Shortlists only candidates whose report exists (Completed or Pending Review) and updates backend DB.
  const shortlistSelected = async (selectedIds: string[]) => {
    const selected = candidates.filter(c => selectedIds.includes(c.id));
    const eligible = selected.filter(
      c => c.status === "Completed" || c.status === "Pending Review"
    );
    const skipped = selected.filter(
      c => c.status !== "Completed" && c.status !== "Pending Review"
    );

    if (eligible.length === 0) {
      toast({
        title: "Cannot Shortlist",
        description: "None of the selected candidates have an interview evaluation report. Only Completed or Pending Review candidates can be shortlisted.",
        variant: "destructive"
      });
      return { eligibleCount: 0, skippedCount: skipped.length };
    }

    const eligibleIds = eligible.map(c => c.id);
    setCandidates(prev =>
      prev.map(c => (eligibleIds.includes(c.id) ? { ...c, status: "Shortlisted" as CandidateStatus } : c))
    );

    try {
      await fetch(API_ENDPOINTS.candidatesShortlist, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_ids: eligibleIds })
      });
    } catch (err) {
      console.warn("Failed to shortlist candidates on backend:", err);
    }

    if (skipped.length > 0) {
      toast({
        title: "Candidates Shortlisted",
        description: `${eligible.length} shortlisted, ${skipped.length} skipped (interview not completed).`
      });
    } else {
      toast({
        title: "Candidates Shortlisted",
        description: `Successfully shortlisted ${eligible.length} candidate(s) for final rounds.`
      });
    }

    return { eligibleCount: eligible.length, skippedCount: skipped.length };
  };

  // Requirement 3: Reject Selected
  // Calls API, updates status to "Rejected", returns restoration map for Undo.
  const rejectSelected = async (selectedIds: string[], reason = "Bulk rejection from recruiter dashboard") => {
    const restorations: Record<string, CandidateStatus> = {};
    for (const c of candidates) {
      if (selectedIds.includes(c.id)) {
        restorations[c.id] = c.status;
      }
    }

    try {
      const response = await fetch(API_ENDPOINTS.candidatesReject, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_ids: selectedIds,
          reason
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned ${response.status}`);
      }

      // Update local state to "Rejected"
      setCandidates(prev =>
        prev.map(c => (selectedIds.includes(c.id) ? { ...c, status: "Rejected" as CandidateStatus } : c))
      );

      return { success: true, restorations };
    } catch (err) {
      console.error("Failed to reject candidates via API:", err);
      toast({
        title: "Rejection Failed",
        description: err instanceof Error ? err.message : "Failed to reject candidates on server. Please try again.",
        variant: "destructive"
      });
      return { success: false };
    }
  };

  // Requirement 3: Undo Reject
  const undoReject = async (restorations: Record<string, CandidateStatus>) => {
    try {
      const response = await fetch(API_ENDPOINTS.candidatesUndoReject, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restorations
        })
      });

      if (!response.ok) {
        console.warn("Undo endpoint responded with error, restoring locally anyway");
      }

      setCandidates(prev =>
        prev.map(c => {
          if (restorations[c.id]) {
            return { ...c, status: restorations[c.id] };
          }
          return c;
        })
      );

      toast({
        title: "Rejection Undone",
        description: `Restored ${Object.keys(restorations).length} candidate(s) to their previous pipeline status.`
      });
      return true;
    } catch (err) {
      console.error("Failed to undo candidate rejection:", err);
      setCandidates(prev =>
        prev.map(c => (restorations[c.id] ? { ...c, status: restorations[c.id] } : c))
      );
      toast({
        title: "Rejection Undone",
        description: `Restored candidate status locally.`
      });
      return true;
    }
  };

  // Requirement 4: Export CSV
  const exportSelectedCSV = (selectedIds: string[]) => {
    const list = selectedIds.length > 0 
      ? candidates.filter(c => selectedIds.includes(c.id))
      : candidates;

    if (list.length === 0) {
      toast({
        title: "No Candidates Selected",
        description: "Select at least one candidate to export.",
        variant: "destructive"
      });
      return;
    }

    const headers = [
      "Name",
      "Email",
      "Role",
      "Type",
      "Status",
      "Score",
      "Verdict",
      "Flags",
      "Date"
    ];

    const getVerdictText = (c: CandidateRecord): string => {
      if (c.status === "Scheduled" || c.status === "In Progress" || c.score === 0) return "N/A";
      if (c.flags && c.flags.length > 0) return "Review Needed";
      if (c.score >= 85) return "Strong Hire";
      if (c.score >= 75) return "Recommended";
      if (c.score >= 60) return "Review Needed";
      return "Not Recommended";
    };

    const rows = list.map(c => {
      const flagsText = c.flags && c.flags.length > 0 
        ? c.flags.map(f => `[${f.time}] ${f.type}: ${f.reason}`).join(" | ")
        : "None";
      const dateText = c.status === "Scheduled" ? (c.scheduledTime || c.completedAt) : c.completedAt;

      return [
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.email.replace(/"/g, '""')}"`,
        `"${c.role.replace(/"/g, '""')}"`,
        `"${c.type}"`,
        `"${c.status}"`,
        c.score,
        `"${getVerdictText(c)}"`,
        `"${flagsText.replace(/"/g, '""')}"`,
        `"${dateText}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `AI_Interview_Agent_Candidates_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Downloaded CSV with ${list.length} candidate record(s).`
    });
  };

  return (
    <CandidateContext.Provider
      value={{
        candidates,
        counts,
        isLoading,
        error,
        lastUpdated,
        refreshCandidates,
        setCandidates,
        updateCandidateStatus,
        shortlistSelected,
        rejectSelected,
        undoReject,
        exportSelectedCSV
      }}
    >
      {children}
    </CandidateContext.Provider>
  );
};

export const useCandidates = (): CandidateContextType => {
  const ctx = useContext(CandidateContext);
  if (!ctx) {
    throw new Error("useCandidates must be used within a CandidateProvider");
  }
  return ctx;
};
