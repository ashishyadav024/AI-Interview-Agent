import React from "react";
import { useNavigate } from "react-router-dom";
import { Brain } from "lucide-react";

interface InterviewLayoutProps {
  children: React.ReactNode;
  candidateName?: string;
  isRecruiter?: boolean;
  isDemo?: boolean;
  onLogout?: () => void;
  maxWidthClass?: string;
}

export const InterviewLayout: React.FC<InterviewLayoutProps> = ({
  children,
  candidateName,
  isRecruiter = false,
  isDemo = false,
  onLogout,
  maxWidthClass = "max-w-6xl",
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] text-[var(--text)] flex flex-col font-['Chivo',sans-serif]">
      {/* Minimal Top Header - strictly for Interview Room, never shows recruiter sidebar/tabs */}
      <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Left: Brand Logo & Assessment Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[var(--text)] font-['Plus_Jakarta_Sans',sans-serif] tracking-tight">
              AI Interview <span className="text-[var(--primary)]">Agent</span>
            </span>
            <span className="hidden sm:inline-block text-[11px] font-mono bg-blue-50 dark:bg-blue-950/50 text-[var(--primary)] px-2 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-800">
              {isDemo ? "Recruiter Demo Sandbox" : "Candidate Assessment"}
            </span>
          </div>
        </div>

        {/* Right: Actions depending on role */}
        <div className="flex items-center gap-3">
          {isDemo ? (
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-3.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">science</span>
              <span>Exit Demo (Back to Dashboard)</span>
            </button>
          ) : (
            <>
              {candidateName && (
                <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-[var(--text)]">
                  <div className="w-7 h-7 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] font-bold flex items-center justify-center text-xs">
                    {candidateName.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[140px] truncate">{candidateName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5 shadow-xs bg-white"
                title="Exit Assessment"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                <span>Exit</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area: Centered, max-w, generous bottom padding, no horizontal clipping */}
      <main className={`w-full ${maxWidthClass} mx-auto px-4 md:px-6 py-6 flex-1 flex flex-col gap-6 box-border min-w-0 pb-20`}>
        {children}
      </main>
    </div>
  );
};

export default InterviewLayout;
