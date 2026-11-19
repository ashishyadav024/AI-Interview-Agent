import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain } from "lucide-react";
import { useCandidates } from "@/context/CandidateContext";

interface SidebarProps {
  candidateCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  candidateCount,
  isOpen = false,
  onClose 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Dynamic Authenticated User Info
  const storedUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("auth_user") || "null") : null;
  const currentUserName = storedUser?.name || "Alex Morgan";
  const currentUserEmail = storedUser?.email || "alex.morgan@company.com";
  const currentUserRole = (storedUser?.role || localStorage.getItem("user_role") || "RECRUITER").replace("_", " ");
  const userInitials = currentUserName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "AM";
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Read candidates from centralized CandidateContext
  let contextCandidateCount: number | undefined;
  try {
    const candidateCtx = useCandidates();
    contextCandidateCount = candidateCtx.candidates.length;
  } catch {
    // Outside provider fallback
  }

  // Synchronize candidate count with Recent Candidates source
  const [resolvedCandidateCount, setResolvedCandidateCount] = useState<number>(() => {
    if (contextCandidateCount !== undefined) return contextCandidateCount;
    if (candidateCount !== undefined) return candidateCount;
    try {
      const stored = localStorage.getItem("ai_interview_candidates");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.length;
        }
      }
    } catch {
      // fallback
    }
    return 6;
  });

  useEffect(() => {
    if (contextCandidateCount !== undefined) {
      setResolvedCandidateCount(contextCandidateCount);
    } else if (candidateCount !== undefined) {
      setResolvedCandidateCount(candidateCount);
    } else {
      try {
        const stored = localStorage.getItem("ai_interview_candidates");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setResolvedCandidateCount(parsed.length);
          }
        }
      } catch {
        // fallback
      }
    }
  }, [contextCandidateCount, candidateCount, location.pathname]);

  const pathname = location.pathname;

  // Determine active item based on current route
  const isOverviewActive = pathname === "/dashboard" || pathname === "/recruiter-dashboard" || pathname === "/";
  const isCandidatesActive = pathname === "/candidates";
  const isInterviewsActive = pathname === "/interview" || pathname === "/interviews" || pathname.startsWith("/interview/");
  const isReportsActive = pathname === "/reports";
  const isJobRolesActive = pathname === "/job-roles";
  const isSettingsActive = pathname === "/settings";
  const isHelpActive = pathname === "/help" || pathname === "/help-support";

  // Handle outside click for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          SIDEBAR NAVIGATION (Stitch Spec: 288px fixed left)
      ───────────────────────────────────────────────────────────── */}
      <aside 
        className={`fixed left-0 top-0 h-screen w-72 bg-[var(--surface-alt)] flex flex-col justify-between z-50 shadow-soft-sm border-r border-[var(--border)] transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col flex-1">
          {/* Brand Logo & Header */}
          <div className="p-5 flex items-center justify-between">
            <button 
              onClick={() => handleNavigate("/dashboard")}
              className="flex items-center gap-3 text-left group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-['Plus_Jakarta_Sans',sans-serif] text-[1.125rem] text-[var(--text)] tracking-tight font-bold group-hover:text-[var(--primary)] transition-colors">
                  AI Interview Agent
                </span>
                <span className="text-[0.6875rem] text-[var(--primary)] uppercase tracking-wider font-semibold">
                  RECRUITER WORKSPACE
                </span>
              </div>
            </button>

            {/* Mobile Close Button */}
            <button 
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg)]"
              aria-label="Close navigation"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="px-3 py-1">
            <div className="h-[1px] w-full bg-[var(--border)]" />
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-3 space-y-1">
            {/* Overview */}
            <button
              onClick={() => handleNavigate("/dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isOverviewActive
                  ? "bg-[var(--primary)] text-white font-semibold shadow-soft-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span>Overview</span>
            </button>

            {/* Candidates */}
            <button
              onClick={() => handleNavigate("/candidates")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isCandidatesActive
                  ? "bg-[var(--primary)] text-white font-semibold shadow-soft-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span>Candidates</span>
              <span 
                className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold transition-colors ${
                  isCandidatesActive ? "bg-white/20 text-white" : "bg-[var(--primary-soft)]/25 text-[var(--primary)]"
                }`}
                title={`Active Candidates: ${resolvedCandidateCount} candidates currently tracked in the recruitment pipeline`}
              >
                {resolvedCandidateCount}
              </span>
            </button>

            {/* Interviews */}
            <button
              onClick={() => handleNavigate("/interview")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isInterviewsActive
                  ? "bg-[var(--primary)] text-white font-semibold shadow-soft-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">video_camera_front</span>
              <span>Interviews</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--danger)]/15 text-[var(--danger)] font-bold border border-[var(--danger)]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                Live
              </span>
            </button>

            {/* Reports */}
            <button
              onClick={() => handleNavigate("/reports")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isReportsActive
                  ? "bg-[var(--primary)] text-white font-semibold shadow-soft-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              <span>Reports</span>
            </button>

            {/* Job Roles */}
            <button
              onClick={() => handleNavigate("/job-roles")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isJobRolesActive
                  ? "bg-[var(--primary)] text-white font-semibold shadow-soft-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">work</span>
              <span>Job Roles</span>
            </button>
          </nav>
        </div>

        {/* Bottom Recruiter Profile & Settings */}
        <div className="p-3 flex flex-col gap-2 relative" ref={profileDropdownRef}>
          <div className="space-y-0.5">
            {/* Settings */}
            <button 
              onClick={() => handleNavigate("/settings")}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm transition-colors ${
                isSettingsActive
                  ? "bg-[var(--primary)] text-white font-semibold shadow-soft-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span>Settings</span>
            </button>

            {/* Help & Support */}
            <button 
              onClick={() => handleNavigate("/help")}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm transition-colors ${
                isHelpActive
                  ? "bg-[var(--primary)] text-white font-semibold shadow-soft-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">help</span>
              <span>Help & Support</span>
            </button>
          </div>

          <div className="h-[1px] w-full bg-[var(--border)] my-1" />

          {/* Interactive Profile Dropdown Popover */}
          {isProfileOpen && (
            <div className="absolute bottom-[72px] left-3 right-3 bg-[var(--surface)] rounded-xl shadow-soft-lg border border-[var(--border)] p-2.5 z-50 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-2.5 py-2 rounded-lg bg-[var(--surface-alt)] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-xs">
                  {userInitials}
                </div>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="text-xs font-bold text-[var(--text)] truncate">{currentUserName}</span>
                  <span className="text-[10px] text-[var(--text-muted)] truncate">{currentUserEmail}</span>
                </div>
              </div>

              <div className="h-[1px] w-full bg-[var(--border)] my-0.5" />

              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  handleNavigate("/settings");
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[16px] text-[var(--primary)]">account_circle</span>
                <span>Profile & Account</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  handleNavigate("/help");
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[16px] text-[var(--primary)]">support</span>
                <span>Documentation & Help</span>
              </button>

              <div className="h-[1px] w-full bg-[var(--border)] my-0.5" />

              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  localStorage.removeItem("user_authenticated");
                  localStorage.removeItem("auth_user");
                  localStorage.removeItem("user_role");
                  handleNavigate("/login");
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Recruiter Identity Pill */}
          <button 
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary-soft)] shadow-soft-sm transition-all text-left focus:outline-none"
            aria-expanded={isProfileOpen}
            aria-label="User profile menu"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {userInitials}
              </div>
              <div className="flex flex-col text-left leading-tight overflow-hidden">
                <span className="text-sm font-semibold text-[var(--text)] truncate">{currentUserName}</span>
                <span className="text-[0.6875rem] text-[var(--text-muted)] capitalize truncate">{currentUserRole}</span>
              </div>
            </div>
            <span className={`material-symbols-outlined text-[var(--text-muted)] text-[18px] transition-transform duration-150 ${
              isProfileOpen ? "rotate-180 text-[var(--primary)]" : ""
            }`}>
              unfold_more
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

