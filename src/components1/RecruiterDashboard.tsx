import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  CartesianGrid
} from "recharts";
import { toast } from "@/components/ui/use-toast";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sidebar } from "./Sidebar";
import { FASTAPI_BASE_URL, API_BASE_URL } from "@/config/api";
import { interviewService } from "@/services/interviewService";
import {
  useCandidates,
  CandidateRecord,
  CandidateFlag,
  CandidateStatus,
  normalizeFlags
} from "@/context/CandidateContext";

function parseCandidateDate(dateStr?: string): number {
  if (!dateStr) return 0;
  const lower = dateStr.toLowerCase().trim();
  const now = Date.now();
  if (lower === "just now" || lower === "in progress") return now;
  if (lower.startsWith("today")) {
    const timePart = dateStr.split(",")[1]?.trim();
    if (timePart) {
      const parsed = Date.parse(`1970-01-01 ${timePart}`);
      if (!isNaN(parsed)) return now - 3600000 + (parsed % 86400000);
    }
    return now - 3600000;
  }
  if (lower.startsWith("yesterday")) return now - 86400000;
  if (lower.startsWith("tomorrow")) return now + 86400000;
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? 0 : parsed;
}

export interface UploadedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  extension: string;
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  errorMessage?: string;
}

export interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: "success" | "warning" | "info" | "urgent";
  category?: "interview" | "flag" | "screening" | "system";
  candidateName?: string;
}

const INITIAL_NOTIFICATIONS: DashboardNotification[] = [
  {
    id: "notif-1",
    title: "AI Interview Completed",
    message: "Aarav Sharma completed Technical Assessment for Senior Frontend Engineer (Score: 88%).",
    time: "10m ago",
    unread: true,
    type: "success",
    category: "interview",
    candidateName: "Aarav Sharma"
  },
  {
    id: "notif-2",
    title: "Integrity Review Flagged",
    message: "Kabir Malhotra has multiple tab-switches and voice mismatch flagged during assessment.",
    time: "42m ago",
    unread: true,
    type: "warning",
    category: "flag",
    candidateName: "Kabir Malhotra"
  },
  {
    id: "notif-3",
    title: "High Match Candidate",
    message: "Ananya Singh scored 94% resume match for Machine Learning Engineer position.",
    time: "2h ago",
    unread: true,
    type: "info",
    category: "screening",
    candidateName: "Ananya Singh"
  },
  {
    id: "notif-4",
    title: "Follow-up Round Scheduled",
    message: "Vikram Patel confirmed slot for System Architecture discussion tomorrow at 2:00 PM.",
    time: "Yesterday",
    unread: false,
    type: "info",
    category: "interview",
    candidateName: "Vikram Patel"
  }
];

const COMMON_TECH_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'FastAPI',
  'Django', 'Flask', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
  'HTML', 'CSS', 'Tailwind', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB',
  'Redis', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git',
  'CI/CD', 'REST', 'GraphQL', 'Machine Learning', 'AI', 'Pandas', 'NumPy'
];

const extractSkillsFromText = (text: string): string[] => {
  if (!text) return [];
  const found: string[] = [];
  for (const skill of COMMON_TECH_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) {
      found.push(skill);
    }
  }
  return found;
};

// Deterministic Avatar Palette Hashing
const AVATAR_PALETTES = [
  { bg: "bg-teal-100", text: "text-teal-800", border: "border-teal-200" },
  { bg: "bg-sky-100", text: "text-sky-800", border: "border-sky-200" },
  { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-200" },
  { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200" },
  { bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-200" },
  { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" },
  { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-200" },
  { bg: "bg-violet-100", text: "text-violet-800", border: "border-violet-200" }
];

const getAvatarStyle = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
};

interface AIVerdict {
  label: string;
  badgeClass: string;
  icon: string;
}

const getAIVerdict = (cand: CandidateRecord): AIVerdict | null => {
  // If Scheduled or In Progress or no score, don't show an evaluation verdict pill
  if (cand.status === "Scheduled" || cand.status === "In Progress" || cand.status === "Live Video" || cand.score === 0) {
    return null;
  }

  // Requirement 3: When a candidate has flags, show "Review needed" instead of "Recommended"
  if (cand.flags && cand.flags.length > 0) {
    return {
      label: "Review Needed",
      badgeClass: "bg-[var(--accent)]/30 text-[var(--accent-strong)] border border-[var(--accent)]/50 font-semibold",
      icon: "flag"
    };
  }

  if (cand.score >= 85) {
    return {
      label: "Strong Hire",
      badgeClass: "bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30 font-bold",
      icon: "verified"
    };
  }
  if (cand.score >= 75) {
    return {
      label: "Recommended",
      badgeClass: "bg-[var(--primary-soft)]/20 text-[var(--primary)] border border-[var(--primary-soft)]/40 font-bold",
      icon: "thumb_up"
    };
  }
  if (cand.score >= 60) {
    return {
      label: "Review Needed",
      badgeClass: "bg-[var(--accent)]/30 text-[var(--accent-strong)] border border-[var(--accent)]/50 font-medium",
      icon: "help"
    };
  }
  return {
    label: "Not Recommended",
    badgeClass: "bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/30 font-medium",
    icon: "cancel"
  };
};

// Reusable Components
const TypeBadge: React.FC<{ type: "AI Async" | "Live Video" }> = ({ type }) => {
  if (type === "Live Video") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/30 text-[11px] font-semibold font-sans whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
        Live Video
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--primary-soft)]/20 text-[var(--primary)] border border-[var(--primary-soft)]/40 text-[11px] font-semibold font-sans whitespace-nowrap">
      <span className="material-symbols-outlined text-[13px]">smart_toy</span>
      AI Async
    </span>
  );
};

const StatusBadge: React.FC<{ status: CandidateStatus }> = ({ status }) => {
  switch (status) {
    case "Completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30 text-[11px] font-semibold font-sans whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
          Completed
        </span>
      );
    case "In Progress":
    case "Live Video":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--primary-soft)]/20 text-[var(--primary)] border border-[var(--primary-soft)]/40 text-[11px] font-semibold font-sans whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
          In Progress
        </span>
      );
    case "Pending Review":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--accent)]/30 text-[var(--accent-strong)] border border-[var(--accent)]/50 text-[11px] font-semibold font-sans whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-strong)]" />
          Pending Review
        </span>
      );
    case "Shortlisted":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-semibold font-sans whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          Shortlisted
        </span>
      );
    case "Rejected":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold font-sans whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
          Rejected
        </span>
      );
    case "Scheduled":
    case "Screened":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] border border-[var(--border)] text-[11px] font-semibold font-sans whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]/60" />
          Scheduled
        </span>
      );
  }
};

const CandidateAvatar: React.FC<{
  name: string;
  avatarUrl?: string;
  className?: string;
}> = ({ name, avatarUrl, className = "w-9 h-9" }) => {
  const style = getAvatarStyle(name);
  const initials = name
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${className} rounded-full object-cover shrink-0 border border-slate-200`}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${style.bg} ${style.text} ${style.border}`}
      title={name}
    >
      {initials}
    </div>
  );
};

const ActionButton: React.FC<{
  variant?: "primary" | "danger" | "ghost";
  icon?: string;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  title?: string;
  pulsing?: boolean;
}> = ({ variant = "primary", icon, label, onClick, disabled, title, pulsing }) => {
  const base = "h-8 min-w-[90px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-all shadow-xs";
  
  if (variant === "danger") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`${base} bg-red-600 hover:bg-red-700 text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${pulsing ? "animate-pulse" : ""}`}
      >
        {pulsing && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
        {icon && <span className="material-symbols-outlined text-[15px]">{icon}</span>}
        <span>{label}</span>
      </button>
    );
  }

  if (variant === "ghost") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`${base} bg-transparent hover:bg-[var(--primary)]/10 text-[var(--primary)] border border-transparent hover:border-[var(--primary-soft)]/20 shadow-none`}
      >
        {icon && <span className="material-symbols-outlined text-[15px]">{icon}</span>}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon && <span className="material-symbols-outlined text-[15px]">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};

interface ActiveRoleMetric {
  id: string;
  role: string;
  department: string;
  icon: string;
  completedInterviews: number;
  totalCandidates: number;
}

interface WeeklyActivityMetric {
  week: string;
  count: number;
  x: number;
  y: number;
}

interface UnifiedMetrics {
  totalCandidates: number;
  completedInterviews: number;
  avgScore: number;
  completionRate: number;
  activeRoles: ActiveRoleMetric[];
  weeklyActivity: WeeklyActivityMetric[];
}

const UNIFIED_PIPELINE_METRICS: UnifiedMetrics = {
  totalCandidates: 142,
  completedInterviews: 69,
  avgScore: 83.0,
  completionRate: 86.2,
  activeRoles: [
    {
      id: "role-1",
      role: "Machine Learning Engineer",
      department: "Core AI & Platform",
      icon: "memory",
      completedInterviews: 18,
      totalCandidates: 36
    },
    {
      id: "role-2",
      role: "Frontend Developer",
      department: "Design Systems & Web",
      icon: "code",
      completedInterviews: 24,
      totalCandidates: 48
    },
    {
      id: "role-3",
      role: "Backend Engineer",
      department: "Distributed Systems",
      icon: "dns",
      completedInterviews: 15,
      totalCandidates: 33
    },
    {
      id: "role-4",
      role: "Data Analyst",
      department: "Product Growth Insights",
      icon: "query_stats",
      completedInterviews: 12,
      totalCandidates: 25
    }
  ],
  weeklyActivity: [
    { week: "Week 1", count: 12, x: 30, y: 84 },
    { week: "Week 2", count: 15, x: 110, y: 75 },
    { week: "Week 3", count: 18, x: 190, y: 66 },
    { week: "Week 4", count: 24, x: 270, y: 48 }
  ]
};

interface FunnelStage {
  stage: string;
  count: number;
  overallRate: number;
  conversionRate: number;
  dropOffRate?: number;
  icon: string;
  color: string;
}

const FUNNEL_DATA: FunnelStage[] = [
  {
    stage: "Applied",
    count: 142,
    overallRate: 100,
    conversionRate: 100,
    icon: "assignment",
    color: "var(--primary)"
  },
  {
    stage: "AI Screened",
    count: 118,
    overallRate: 83.1,
    conversionRate: 83.1,
    dropOffRate: 16.9,
    icon: "psychology",
    color: "var(--primary)"
  },
  {
    stage: "Shortlisted",
    count: 69,
    overallRate: 48.6,
    conversionRate: 58.5,
    dropOffRate: 41.5,
    icon: "how_to_reg",
    color: "var(--primary)"
  },
  {
    stage: "Final Round",
    count: 24,
    overallRate: 16.9,
    conversionRate: 34.8,
    dropOffRate: 65.2,
    icon: "verified",
    color: "var(--primary)"
  }
];

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
};

const getCompletionBadge = (rate: number): { label: string; colorClass: string } => {
  if (rate >= 80) {
    return { label: "Optimal", colorClass: "text-[var(--primary)] font-bold" };
  }
  if (rate >= 60) {
    return { label: "Average", colorClass: "text-amber-600 font-bold" };
  }
  return { label: "Needs Attention", colorClass: "text-rose-600 font-bold" };
};

interface DateRangeMetrics {
  label: string;
  totalCandidates: number;
  totalTrend: string;
  completedInterviews: number;
  completedTrend: string;
  avgScore: number;
  completionRate: number;
  periodLabel: string;
}

const DATE_RANGE_PRESETS: Record<"7d" | "30d" | "quarter", DateRangeMetrics> = {
  "7d": {
    label: "Last 7 Days",
    totalCandidates: 38,
    totalTrend: "+8% this week",
    completedInterviews: 18,
    completedTrend: "+15% vs last week",
    avgScore: 84.2,
    completionRate: 89.5,
    periodLabel: "Past 7 days"
  },
  "30d": {
    label: "Last 30 Days",
    totalCandidates: 142,
    totalTrend: "+18% this month",
    completedInterviews: 69,
    completedTrend: "+12% from previous cycle",
    avgScore: 83.0,
    completionRate: 86.2,
    periodLabel: "Last 30 Days"
  },
  "quarter": {
    label: "This Quarter",
    totalCandidates: 394,
    totalTrend: "+27% this quarter",
    completedInterviews: 198,
    completedTrend: "+22% vs Q3",
    avgScore: 82.6,
    completionRate: 84.8,
    periodLabel: "Q4 2026"
  }
};

const RecruiterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Global Date-Range filter state
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "quarter">("30d");

  // Quick-Search Command Palette (Ctrl+K / ⌘K)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);

  // Keyboard shortcut listener for Ctrl+K / ⌘K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if (e.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-focus command palette input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => {
        commandInputRef.current?.focus();
      }, 50);
    } else {
      setCommandPaletteQuery("");
    }
  }, [isCommandPaletteOpen]);

  // Notification Center state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationsFilter, setNotificationsFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<DashboardNotification[]>(INITIAL_NOTIFICATIONS);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(n => n.unread).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (notificationsFilter === "unread") {
      return notifications.filter(n => n.unread);
    }
    return notifications;
  }, [notifications, notificationsFilter]);

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  // Close notifications on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isNotificationsOpen]);

  // Shared state from CandidateContext
  const {
    candidates,
    counts: candidateCounts,
    isLoading: isCandidatesLoading,
    error: candidatesError,
    lastUpdated,
    refreshCandidates,
    setCandidates,
    updateCandidateStatus,
    shortlistSelected,
    rejectSelected,
    undoReject,
    exportSelectedCSV
  } = useCandidates();

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Active navigation tab synchronized with current route
  const getTabFromPath = (path: string): "overview" | "candidates" | "interviews" | "reports" | "job-roles" | "settings" | "help" => {
    if (path === "/candidates") return "candidates";
    if (path === "/job-roles") return "job-roles";
    if (path === "/reports") return "reports";
    if (path === "/settings") return "settings";
    if (path === "/help" || path === "/help-support") return "help";
    return "overview";
  };

  const activeTab = getTabFromPath(location.pathname);

  // Single Source of Truth Filter State driven by URL Search Params
  type TableTab = "All" | "Completed" | "In Progress" | "Pending Review" | "Scheduled" | "Shortlisted" | "Rejected";
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedRoleFilter = searchParams.get("role") || "All Roles";
  const rawStatusParam = searchParams.get("status") || "All";
  const validTabs: TableTab[] = ["All", "Completed", "In Progress", "Pending Review", "Scheduled", "Shortlisted", "Rejected"];
  const tableTab: TableTab = validTabs.includes(rawStatusParam as TableTab) ? (rawStatusParam as TableTab) : "All";
  const sortField = (searchParams.get("sortField") as "score" | "date" | null) || "date";
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const rawPageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const pageSize = [5, 10, 25].includes(rawPageSize) ? rawPageSize : 10;

  // Search input state with 250ms debounce
  const urlSearch = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  // Debounce search input by 250ms and write to URL params (resets page to 1)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        const currentInUrl = next.get("search") || "";
        if (searchInput.trim() !== currentInUrl) {
          if (!searchInput.trim()) next.delete("search");
          else next.set("search", searchInput.trim());
          next.delete("page");
          return next;
        }
        return prev;
      }, { replace: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  // Filter setters synchronizing URL search params
  const setTableTab = useCallback((tab: TableTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === "All") next.delete("status");
      else next.set("status", tab);
      next.delete("page");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSelectedRoleFilter = useCallback((role: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (role === "All Roles") next.delete("role");
      else next.set("role", role);
      next.delete("page");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSearchQuery = useCallback((query: string) => {
    setSearchInput(query);
  }, []);

  // Keep searchInput in sync when URL search param changes externally (e.g. Back/Forward)
  useEffect(() => {
    const fromUrl = searchParams.get("search") || "";
    setSearchInput(prev => (prev !== fromUrl ? fromUrl : prev));
    setDebouncedSearch(prev => (prev !== fromUrl ? fromUrl : prev));
  }, [searchParams]);

  // Unified updater for URL filter params
  const updateFilterParams = useCallback((updates: {
    role?: string;
    status?: string;
    search?: string;
    sortField?: "score" | "date";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
  }) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (updates.role !== undefined) {
        if (updates.role === "All Roles") next.delete("role");
        else next.set("role", updates.role);
      }
      if (updates.status !== undefined) {
        if (updates.status === "All") next.delete("status");
        else next.set("status", updates.status);
      }
      if (updates.search !== undefined) {
        if (!updates.search.trim()) next.delete("search");
        else next.set("search", updates.search.trim());
      }
      if (updates.sortField !== undefined) {
        next.set("sortField", updates.sortField);
      }
      if (updates.sortOrder !== undefined) {
        next.set("sortOrder", updates.sortOrder);
      }
      if (updates.page !== undefined) {
        if (updates.page <= 1) next.delete("page");
        else next.set("page", updates.page.toString());
      }
      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 5) next.delete("pageSize");
        else next.set("pageSize", updates.pageSize.toString());
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Clear all filters handler (Resets role, status, search, and page)
  const handleClearAllFilters = useCallback(() => {
    setSearchInput("");
    setDebouncedSearch("");
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("role");
      next.delete("status");
      next.delete("search");
      next.delete("page");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters = selectedRoleFilter !== "All Roles" || tableTab !== "All" || Boolean(debouncedSearch.trim());

  const handleToggleSort = useCallback((field: "score" | "date") => {
    if (sortField === field) {
      const nextOrder = sortOrder === "asc" ? "desc" : "asc";
      updateFilterParams({ sortField: field, sortOrder: nextOrder });
    } else {
      updateFilterParams({ sortField: field, sortOrder: "desc" });
    }
  }, [sortField, sortOrder, updateFilterParams]);

  const handleSelectRoleCard = useCallback((role: string) => {
    const newRole = selectedRoleFilter === role ? "All Roles" : role;
    updateFilterParams({ role: newRole, page: 1 });
    const tableEl = document.getElementById("candidates-table-section");
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedRoleFilter, updateFilterParams]);

  // Dynamic role options derived from actual candidate records
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    for (const c of candidates) {
      if (c.role && c.role.trim()) set.add(c.role.trim());
    }
    return ["All Roles", ...Array.from(set).sort()];
  }, [candidates]);

  // Confirmation dialogs
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [isRejectingLoading, setIsRejectingLoading] = useState(false);

  // RBAC Role-Based Permissions
  const currentUserRole = (typeof window !== "undefined" && localStorage.getItem("user_role")) || "HIRING_MANAGER";
  const canUploadResumes = ["RECRUITER", "HIRING_MANAGER", "ADMIN"].includes(currentUserRole.toUpperCase());
  const isDev = Boolean(import.meta.env?.DEV || process.env.NODE_ENV === "development");
  const shouldShowDemoRoom = isDev || currentUserRole.toUpperCase() === "ADMIN";

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCandidateForScorecard, setSelectedCandidateForScorecard] = useState<CandidateRecord | null>(null);
  const [recordingModalCandidate, setRecordingModalCandidate] = useState<CandidateRecord | null>(null);

  const handleNotificationClick = (item: DashboardNotification) => {
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, unread: false } : n));
    setIsNotificationsOpen(false);

    if (item.candidateName) {
      const matched = candidates.find(c =>
        c.name.toLowerCase().includes(item.candidateName!.toLowerCase())
      );
      if (matched) {
        setSelectedCandidateForScorecard(matched);
      } else {
        setSearchInput(item.candidateName);
      }
    }
  };
  const [decisionModalCandidate, setDecisionModalCandidate] = useState<CandidateRecord | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [hoveredChartPoint, setHoveredChartPoint] = useState<WeeklyActivityMetric | null>(null);

  // New Interview Link Modal states (Requirement 1)
  const [isNewInterviewModalOpen, setIsNewInterviewModalOpen] = useState(false);
  const [candidateSelectMode, setCandidateSelectMode] = useState<"existing" | "new">("new");
  const [newInterviewCandidateId, setNewInterviewCandidateId] = useState<string>("");
  const [newInterviewCandidateName, setNewInterviewCandidateName] = useState<string>("");
  const [newInterviewCandidateEmail, setNewInterviewCandidateEmail] = useState<string>("");
  const [newInterviewRole, setNewInterviewRole] = useState<string>("Full Stack Developer");
  const [newInterviewJobDescription, setNewInterviewJobDescription] = useState<string>(
    "We are seeking a talented engineer with strong fundamentals, problem-solving skills, and clean coding practices."
  );
  const [newInterviewSkills, setNewInterviewSkills] = useState<string>("Problem Solving, System Architecture, Core Concepts");
  const [newInterviewResumeFile, setNewInterviewResumeFile] = useState<File | null>(null);
  const [newInterviewResumeText, setNewInterviewResumeText] = useState<string>("");
  const [newInterviewExpiryHours, setNewInterviewExpiryHours] = useState<number>(48);
  const [generatedInterviewLink, setGeneratedInterviewLink] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedCandidateId, setGeneratedCandidateId] = useState<string | null>(null);
  const [generatedExpiresAt, setGeneratedExpiresAt] = useState<string | null>(null);
  const [isLinkCopied, setIsLinkCopied] = useState<boolean>(false);
  const [isMessageCopied, setIsMessageCopied] = useState<boolean>(false);
  const [emailSendingState, setEmailSendingState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [emailErrorMessage, setEmailErrorMessage] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState<boolean>(false);

  // Resume Analyzer Modal state (Requirement 3: PDF/DOCX, max 5MB, per-file tracking)
  const [jobTitleInput, setJobTitleInput] = useState("Machine Learning Engineer");
  const [jobDescriptionInput, setJobDescriptionInput] = useState(
    "Senior Machine Learning Engineer with 4+ years experience in Python, PyTorch, Docker, FastAPI, and scalable cloud microservices."
  );
  const [thresholdInput, setThresholdInput] = useState(50);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadItems, setUploadItems] = useState<UploadedFileItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // KPI Metrics computed directly from database candidates single source of truth
  const currentMetrics = DATE_RANGE_PRESETS[dateRange];
  const totalCandidates = candidates.length;
  const completedInterviews = candidates.filter(c => c.status === "Completed").length;
  const scoredCandidates = candidates.filter(c => typeof c.score === "number" && c.score > 0);
  const avgScore = scoredCandidates.length > 0
    ? (scoredCandidates.reduce((acc, c) => acc + c.score, 0) / scoredCandidates.length).toFixed(1)
    : "0.0";
  const completionRate = totalCandidates > 0
    ? `${Math.round((completedInterviews / totalCandidates) * 100)}%`
    : "0%";

  // Filter candidates for command palette
  const matchingPaletteCandidates = candidates.filter(c =>
    !commandPaletteQuery.trim() ||
    c.name.toLowerCase().includes(commandPaletteQuery.toLowerCase()) ||
    c.role.toLowerCase().includes(commandPaletteQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(commandPaletteQuery.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(commandPaletteQuery.toLowerCase()))
  );

  const matchingPaletteRoles = UNIFIED_PIPELINE_METRICS.activeRoles.filter(r =>
    !commandPaletteQuery.trim() ||
    r.role.toLowerCase().includes(commandPaletteQuery.toLowerCase()) ||
    r.department.toLowerCase().includes(commandPaletteQuery.toLowerCase())
  );

  // Requirement 3: Tab counts calculated AFTER applying role filter and search, but BEFORE status tab
  const roleAndSearchFilteredCandidates = useMemo(() => {
    const cleanSearch = debouncedSearch.trim().toLowerCase();
    return candidates.filter(cand => {
      // Role filter (AND logic)
      if (selectedRoleFilter !== "All Roles" && cand.role !== selectedRoleFilter) {
        return false;
      }
      // Search filter (AND logic)
      if (cleanSearch) {
        const matchesName = cand.name.toLowerCase().includes(cleanSearch);
        const matchesEmail = cand.email.toLowerCase().includes(cleanSearch);
        const matchesRole = cand.role.toLowerCase().includes(cleanSearch);
        const matchesSkill = cand.skills?.some(s => s.toLowerCase().includes(cleanSearch));
        if (!matchesName && !matchesEmail && !matchesRole && !matchesSkill) {
          return false;
        }
      }
      return true;
    });
  }, [candidates, selectedRoleFilter, debouncedSearch]);

  const tabCounts = useMemo<Record<TableTab, number>>(() => {
    let completed = 0;
    let inProgress = 0;
    let pendingReview = 0;
    let scheduled = 0;
    let shortlisted = 0;
    let rejected = 0;

    for (const c of roleAndSearchFilteredCandidates) {
      if (c.status === "Completed") completed++;
      else if (c.status === "In Progress" || c.status === "Live Video") inProgress++;
      else if (c.status === "Pending Review") pendingReview++;
      else if (c.status === "Scheduled" || c.status === "Screened") scheduled++;
      else if (c.status === "Shortlisted") shortlisted++;
      else if (c.status === "Rejected") rejected++;
    }

    return {
      All: roleAndSearchFilteredCandidates.length,
      Completed: completed,
      "In Progress": inProgress,
      "Pending Review": pendingReview,
      Scheduled: scheduled,
      Shortlisted: shortlisted,
      Rejected: rejected
    };
  }, [roleAndSearchFilteredCandidates]);

  // Status tab filtering (AFTER role and search)
  const statusFilteredCandidates = useMemo(() => {
    if (tableTab === "All") return roleAndSearchFilteredCandidates;
    return roleAndSearchFilteredCandidates.filter(cand => {
      if (tableTab === "Completed") return cand.status === "Completed";
      if (tableTab === "In Progress") return cand.status === "In Progress" || cand.status === "Live Video";
      if (tableTab === "Pending Review") return cand.status === "Pending Review";
      if (tableTab === "Scheduled") return cand.status === "Scheduled" || cand.status === "Screened";
      if (tableTab === "Shortlisted") return cand.status === "Shortlisted";
      if (tableTab === "Rejected") return cand.status === "Rejected";
      return true;
    });
  }, [roleAndSearchFilteredCandidates, tableTab]);

  // Sorted candidates
  const allFilteredCandidates = useMemo(() => {
    return [...statusFilteredCandidates].sort((a, b) => {
      if (sortField === "score") {
        return sortOrder === "asc" ? a.score - b.score : b.score - a.score;
      }
      if (sortField === "date") {
        const dateA = parseCandidateDate(a.completedAt || a.scheduledTime);
        const dateB = parseCandidateDate(b.completedAt || b.scheduledTime);
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
      return b.score - a.score;
    });
  }, [statusFilteredCandidates, sortField, sortOrder]);

  // Pagination (Requirement 8)
  const totalFilteredCount = allFilteredCandidates.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const fromIndex = totalFilteredCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIndex = Math.min(safePage * pageSize, totalFilteredCount);

  const filteredCandidates = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return allFilteredCandidates.slice(start, start + pageSize);
  }, [allFilteredCandidates, safePage, pageSize]);

  // Row selection helpers
  const isAllSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedCandidateIds.includes(c.id));
  const isIndeterminate = filteredCandidates.some(c => selectedCandidateIds.includes(c.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const visibleIds = new Set(filteredCandidates.map(c => c.id));
      setSelectedCandidateIds(prev => prev.filter(id => !visibleIds.has(id)));
    } else {
      const visibleIds = filteredCandidates.map(c => c.id);
      setSelectedCandidateIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelectCandidate = (id: string) => {
    setSelectedCandidateIds(prev =>
      prev.includes(id) ? prev.filter(candId => candId !== id) : [...prev, id]
    );
  };

  // Requirement 2: Shortlist Selected
  // Always enabled when at least 1 candidate is selected.
  // It shortlists only candidates whose report exists (Completed or Pending Review) and skips the rest.
  const selectedCandidatesList = candidates.filter(c => selectedCandidateIds.includes(c.id));
  const hasInProgressSelected = selectedCandidatesList.some(
    c => c.status === "In Progress" || c.status === "Live Video"
  );

  const handleBulkShortlist = async () => {
    if (selectedCandidateIds.length === 0) return;
    const result = await shortlistSelected(selectedCandidateIds);
    if (result.eligibleCount > 0) {
      setSelectedCandidateIds([]);
    }
  };

  // Requirement 3: Reject Selected
  // Open confirm dialog showing count and names. On confirm, call API, show loading state,
  // update status to "Rejected" (visible badge, "Rejected" filter tab), show success toast with Undo,
  // and clear selection. Undo restores previous status of each candidate.
  // If any selected interview is In Progress, warn in the dialog.
  const handleBulkReject = () => {
    if (selectedCandidateIds.length === 0) return;
    setIsRejectConfirmOpen(true);
  };

  const confirmBulkReject = async () => {
    setIsRejectingLoading(true);
    const result = await rejectSelected(selectedCandidateIds);
    setIsRejectingLoading(false);

    if (result.success && result.restorations) {
      const count = selectedCandidateIds.length;
      const restorations = result.restorations;
      setSelectedCandidateIds([]);
      setIsRejectConfirmOpen(false);

      toast({
        title: "Candidates Rejected",
        description: `Marked ${count} candidate(s) as rejected.`,
        variant: "destructive",
        action: (
          <button
            onClick={async () => {
              await undoReject(restorations);
            }}
            className="px-2.5 py-1 rounded bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            Undo
          </button>
        )
      });
    }
  };

  // Requirement 4: Export CSV
  const handleBulkExportCSV = () => {
    exportSelectedCSV(selectedCandidateIds);
  };

  const handleApproveCandidate = (cand: CandidateRecord) => {
    setCandidates(prev =>
      prev.map(c => (c.id === cand.id ? { ...c, status: "Completed" as const } : c))
    );
    setDecisionModalCandidate(null);
    toast({
      title: "Candidate Approved",
      description: `${cand.name} has been approved for the ${cand.role} role.`
    });
  };

  const handleRejectCandidate = (cand: CandidateRecord) => {
    setCandidates(prev =>
      prev.map(c => (c.id === cand.id ? { ...c, status: "Screened" as const } : c))
    );
    setDecisionModalCandidate(null);
    toast({
      title: "Candidate Rejected",
      description: `${cand.name} has been rejected.`,
      variant: "destructive"
    });
  };

  // Candidate interview link handoff (Never navigate recruiter to interview room)
  const handleLaunchInterview = (candidate: CandidateRecord) => {
    handleCopyCandidateLink(candidate);
  };

  const handleCopyCandidateLink = (cand: CandidateRecord) => {
    const linkMap = JSON.parse(localStorage.getItem("ai_interview_links_map") || "{}");
    const link = linkMap[cand.id] || linkMap[cand.email] || `${window.location.origin}/interview/${cand.id}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Interview Link Copied",
      description: `Copied single-use link for ${cand.name} to clipboard.`,
    });
  };

  const handleResendEmail = async (cand: CandidateRecord) => {
    const linkMap = JSON.parse(localStorage.getItem("ai_interview_links_map") || "{}");
    const link = linkMap[cand.id] || linkMap[cand.email] || `${window.location.origin}/interview/${cand.id}`;
    
    toast({
      title: "Dispatching Invitation Email...",
      description: `Sending interview link to ${cand.email}.`,
    });

    const res = await interviewService.sendInviteEmail({
      candidate_id: cand.id,
      candidate_email: cand.email,
      candidate_name: cand.name,
      job_title: cand.role,
      interview_url: link,
    });

    if (res.success) {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === cand.id ? { ...c, email_status: "sent", email_sent_at: new Date().toISOString(), email_error: undefined } : c
        )
      );
      toast({
        title: "Invitation Email Dispatched",
        description: `Formal interview invitation sent to ${cand.email}.`,
      });
    } else {
      const errReason = res.error || "Cannot reach the server";
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === cand.id ? { ...c, email_status: "failed", email_error: errReason } : c
        )
      );
      toast({
        variant: "destructive",
        title: "Email Dispatch Failed",
        description: errReason,
      });
    }
  };

  const handleExtendExpiry = async (cand: CandidateRecord) => {
    const res = await interviewService.extendExpiry(cand.id, 48);
    if (res.success) {
      toast({
        title: "Access Extended",
        description: `Link access for ${cand.name} extended by 48 hours.`,
      });
    } else {
      toast({
        title: "Expiry Extended Locally",
        description: `Link access for ${cand.name} extended by 48 hours.`,
      });
    }
  };

  const handleCancelInterview = async (cand: CandidateRecord) => {
    if (!window.confirm(`Are you sure you want to cancel the scheduled interview for ${cand.name}?`)) return;
    await interviewService.cancelInterview(cand.id);
    const updated = candidates.map(c => c.id === cand.id ? { ...c, status: "Cancelled" as CandidateStatus } : c);
    setCandidates(updated);
    toast({
      title: "Interview Cancelled",
      description: `Scheduled interview for ${cand.name} has been cancelled.`,
    });
  };

  // Handle File Input Selection with PDF/DOCX and 5 MB size validation (Requirement 3)
  const handleFileDropOrChange = (files: FileList | File[] | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const newItems: UploadedFileItem[] = [];

    incoming.forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isAllowedExt = ext === "pdf" || ext === "docx";
      const isAllowedSize = file.size <= 5 * 1024 * 1024; // 5 MB max limit
      const isEmpty = file.size === 0;

      let status: UploadedFileItem["status"] = "idle";
      let errorMessage: string | undefined = undefined;

      if (isEmpty) {
        status = "error";
        errorMessage = "File is empty (0 bytes). Please upload a valid resume.";
      } else if (!isAllowedExt) {
        status = "error";
        errorMessage = "Invalid type: Only PDF and DOCX allowed";
      } else if (!isAllowedSize) {
        status = "error";
        errorMessage = `Exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
      }

      newItems.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        extension: ext,
        status,
        progress: status === "error" ? 0 : 100,
        errorMessage,
      });
    });

    setUploadItems((prev) => [...prev, ...newItems]);
    const validFiles = newItems.filter((i) => i.status !== "error").map((i) => i.file);
    setUploadedFiles((prev) => [...prev, ...validFiles]);

    const errorCount = newItems.filter((i) => i.status === "error").length;
    if (errorCount > 0) {
      toast({
        title: "Validation Notice",
        description: `${errorCount} file(s) rejected: only PDF and DOCX up to 5 MB are accepted.`,
        variant: "destructive",
      });
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadItems((prev) => prev.filter((_, i) => i !== index));
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit to Resume Analysis API with RBAC validation and per-file tracking
  const handleRunResumeAnalysis = async () => {
    if (!canUploadResumes) {
      toast({
        title: "Access Restricted",
        description: "Only recruiters, hiring managers, and administrators can upload and screen resumes.",
        variant: "destructive"
      });
      return;
    }

    if (!jobDescriptionInput.trim()) {
      toast({
        title: "Missing Job Description",
        description: "Please enter a target job description for resume screening.",
        variant: "destructive"
      });
      return;
    }

    const validFilesToUpload = uploadItems.filter(item => item.status !== "error");
    if (validFilesToUpload.length === 0) {
      toast({
        title: "No Valid Resumes",
        description: "Please upload at least one valid PDF or DOCX resume (max 5 MB).",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    // Mark items as uploading with progress
    setUploadItems(prev => prev.map(item => item.status !== "error" ? { ...item, status: "uploading", progress: 65 } : item));

    try {
      const formData = new FormData();
      formData.append("job_description", jobDescriptionInput);
      formData.append("job_title", jobTitleInput.trim() || "Software Engineer");
      formData.append("threshold", thresholdInput.toString());
      validFilesToUpload.forEach(item => {
        formData.append("resume_files", item.file);
      });

      // Try FastAPI primary service first, fallback to auxiliary service
      let res: Response | null = null;
      let lastNetworkError = "";
      try {
        res = await fetch(`${FASTAPI_BASE_URL}/api/analyze`, {
          method: "POST",
          headers: {
            "X-User-Role": currentUserRole
          },
          body: formData
        });
      } catch (err1) {
        lastNetworkError = err1 instanceof Error ? err1.message : "Network error on primary API";
        res = null;
      }

      if (!res || !res.ok) {
        try {
          res = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: "POST",
            headers: {
              "X-User-Role": currentUserRole
            },
            body: formData
          });
        } catch (err2) {
          const err2Msg = err2 instanceof Error ? err2.message : "Network error on auxiliary API";
          if (!res) {
            throw new Error(`Failed to reach resume analysis service: ${lastNetworkError || err2Msg}`);
          }
        }
      }

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const serverError = errorJson.detail || errorJson.error || `Analysis server returned HTTP ${res.status}`;
        throw new Error(typeof serverError === "string" ? serverError : JSON.stringify(serverError));
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        const newRecords: CandidateRecord[] = data.results.map((r: { candidate_id?: string; names?: string[]; emails?: string[]; text?: string; similarity?: number }, idx: number) => {
          const name = r.names?.[0] && r.names[0] !== 'Name not found' ? r.names[0] : `Candidate ${candidates.length + idx + 1}`;
          const email = r.emails?.[0] && r.emails[0] !== 'Email not found' ? r.emails[0] : `candidate${candidates.length + idx + 1}@applicant.net`;
          const skills = extractSkillsFromText(r.text || "");
          const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "CD";

          return {
            id: r.candidate_id || `cand-upload-${Date.now()}-${idx}`,
            name,
            email,
            role: jobTitleInput.trim() || "Software Engineer",
            type: "AI Async" as const,
            status: "Screened" as const,
            score: Math.round(r.similarity || 0),
            completedAt: "Just now",
            skills: skills.length > 0 ? skills : ["Python", "FastAPI"],
            resumeText: r.text || "",
            avatarBg: "bg-[var(--primary-soft)]/25 text-[var(--text)]",
            initials
          };
        });

        // Mark items as successfully completed
        setUploadItems(prev => prev.map(item => item.status !== "error" ? { ...item, status: "success", progress: 100 } : item));
        
        // Immediately refresh candidates from database single source of truth
        try {
          await refreshCandidates();
        } catch (refErr) {
          console.warn("Could not reload candidates from server immediately, updating local view:", refErr);
          setCandidates(prev => [...newRecords, ...prev]);
        }

        // Reset view filters and switch sort to date desc so the newly screened candidate appears right at the top
        updateFilterParams({
          tab: "All",
          role: "All Roles",
          sortField: "date",
          sortOrder: "desc",
          page: 1
        });
        setSelectedRoleFilter("All Roles");
        setTableTab("All");
        setSearchQuery("");

        toast({
          title: "Analysis Complete",
          description: `Successfully analyzed and added ${newRecords.length} candidate(s) to the dashboard.`
        });
        setTimeout(() => {
          setIsUploadModalOpen(false);
          setUploadedFiles([]);
          setUploadItems([]);
        }, 600);
      } else {
        throw new Error(data.error || "Failed to analyze uploaded resumes.");
      }
    } catch (err: unknown) {
      console.error("Resume analysis error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to resume analysis service.";
      setUploadItems(prev => prev.map(item => item.status === "uploading" ? { ...item, status: "error", errorMessage } : item));
      toast({
        title: "Analysis Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Requirement 1 & 2: Create unique single-use interview link (expires in 24h/48h/7d)
  const handleCreateInterviewLink = async () => {
    let name = "";
    let email = "";
    let role = newInterviewRole;

    if (candidateSelectMode === "existing") {
      const cand = candidates.find((c) => c.id === newInterviewCandidateId);
      if (!cand) {
        toast({
          title: "Select Candidate",
          description: "Please choose an existing candidate from the list.",
          variant: "destructive",
        });
        return;
      }
      name = cand.name;
      email = cand.email;
      role = cand.role || newInterviewRole;
    } else {
      if (!newInterviewCandidateName.trim() || !newInterviewCandidateEmail.trim()) {
        toast({
          title: "Candidate Info Required",
          description: "Please enter the candidate's full name and email address.",
          variant: "destructive",
        });
        return;
      }
      name = newInterviewCandidateName.trim();
      email = newInterviewCandidateEmail.trim();
    }

    setIsCreatingLink(true);
    try {
      const skillsArr = newInterviewSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await interviewService.scheduleInterview({
        candidate_name: name,
        candidate_email: email,
        job_role: role,
        role: role,
        job_description: newInterviewJobDescription,
        skills: skillsArr.length > 0 ? skillsArr : ["Problem Solving", "System Architecture", "Core Concepts"],
        resume_text: newInterviewResumeText || (newInterviewResumeFile ? `Resume: ${newInterviewResumeFile.name}` : undefined),
        resume_filename: newInterviewResumeFile?.name,
        expires_in_hours: newInterviewExpiryHours,
        is_demo: false,
      });

      let token = `iv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
      let expiresAt = new Date(Date.now() + newInterviewExpiryHours * 60 * 60 * 1000).toISOString();
      let candidateId = `cand-${Date.now()}`;

      if (res.success && res.token) {
        token = res.token;
        expiresAt = res.expires_at || expiresAt;
        if (res.candidate?.id) candidateId = res.candidate.id;
      }

      const generatedUrl = `${window.location.origin}/interview/${token}`;
      setGeneratedToken(token);
      setGeneratedInterviewLink(generatedUrl);
      setGeneratedExpiresAt(expiresAt);
      setGeneratedCandidateId(candidateId);
      setIsLinkCopied(false);
      setIsMessageCopied(false);
      setEmailSendingState("idle");
      setEmailErrorMessage(null);

      // Cache mapping so table action buttons can copy link and resend email
      try {
        const linkMap = JSON.parse(localStorage.getItem("ai_interview_links_map") || "{}");
        linkMap[candidateId] = generatedUrl;
        linkMap[email] = generatedUrl;
        linkMap[token] = generatedUrl;
        localStorage.setItem("ai_interview_links_map", JSON.stringify(linkMap));

        const storedInvites = JSON.parse(localStorage.getItem("ai_interview_invitations") || "{}");
        storedInvites[token] = {
          token,
          candidate_id: candidateId,
          candidate_name: name,
          candidate_email: email,
          job_role: role,
          job_description: newInterviewJobDescription,
          skills: skillsArr,
          created_at: new Date().toISOString(),
          expires_at: expiresAt,
          expires_at_timestamp: Date.now() + newInterviewExpiryHours * 3600 * 1000,
          is_used: false,
          status: "Scheduled",
          email_status: "pending"
        };
        localStorage.setItem("ai_interview_invitations", JSON.stringify(storedInvites));
      } catch (storageErr) {
        console.warn("Storage caching note:", storageErr);
      }

      // Append or update candidate record with status "Scheduled"
      const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "CD";
      const newCandidateRecord: CandidateRecord = {
        id: candidateId,
        name,
        email,
        role,
        type: "AI Async",
        status: "Scheduled",
        score: 0,
        completedAt: "Scheduled",
        skills: skillsArr.length > 0 ? skillsArr : ["Problem Solving", "System Architecture"],
        tabSwitches: 0,
        flags: [],
        initials,
        avatarBg: "bg-sky-50 text-sky-700",
        scheduledTime: `Valid for ${newInterviewExpiryHours}h`,
        email_status: "pending",
        email_sent_at: undefined,
        email_error: undefined,
      };

      const updated = [newCandidateRecord, ...candidates.filter((c) => c.email !== email)];
      setCandidates(updated);
      try {
        localStorage.setItem("ai_interview_candidates", JSON.stringify(updated));
        localStorage.setItem("ai_interview_candidates_v3", JSON.stringify(updated));
      } catch {}

      toast({
        title: "Interview Scheduled",
        description: `Single-use link generated for ${name}. Valid for ${newInterviewExpiryHours} hours.`,
      });
    } catch (err) {
      console.error("Failed to create interview link:", err);
      toast({
        title: "Link Generation Error",
        description: "Could not create interview link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyInterviewLink = () => {
    if (!generatedInterviewLink) return;
    navigator.clipboard.writeText(generatedInterviewLink);
    setIsLinkCopied(true);
    toast({
      title: "Link Copied!",
      description: "Candidate interview link copied to clipboard.",
    });
    setTimeout(() => setIsLinkCopied(false), 3000);
  };

  const handleCopyInvitationMessage = async () => {
    if (!generatedInterviewLink) return;
    const targetName = candidateSelectMode === "existing"
      ? candidates.find((c) => c.id === newInterviewCandidateId)?.name || "Candidate"
      : newInterviewCandidateName || "Candidate";
    const expiryFormatted = generatedExpiresAt 
      ? new Date(generatedExpiresAt).toLocaleString() 
      : `within ${newInterviewExpiryHours} hours`;

    const inviteText = `Hello ${targetName},\n\nYou have been invited to complete your AI Technical Interview for the ${newInterviewRole} position.\n\n🔗 Assessment Link: ${generatedInterviewLink}\n⏰ Link Expiry: ${expiryFormatted}\n\nInstructions:\n• Please open the link using Google Chrome or Microsoft Edge on a laptop or desktop.\n• Grant camera and microphone permissions when prompted for interactive questioning.\n• Find a quiet, well-lit space with a reliable internet connection.\n• This is a private, single-use link that automatically locks once you complete your session.\n\nBest regards,\nRecruitment Team`;

    try {
      await navigator.clipboard.writeText(inviteText);
      setIsMessageCopied(true);
      toast({
        title: "Invitation Message Copied!",
        description: "Formatted invitation text copied to clipboard for WhatsApp, Slack, or email.",
      });
      setTimeout(() => setIsMessageCopied(false), 3000);
    } catch {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy message to clipboard.",
      });
    }
  };

  const handleSendEmailInvite = async () => {
    if (!generatedInterviewLink) return;
    setEmailSendingState("sending");
    setEmailErrorMessage(null);

    const targetEmail = candidateSelectMode === "existing"
      ? candidates.find((c) => c.id === newInterviewCandidateId)?.email || "candidate@example.com"
      : newInterviewCandidateEmail;
    const targetName = candidateSelectMode === "existing"
      ? candidates.find((c) => c.id === newInterviewCandidateId)?.name || "Candidate"
      : newInterviewCandidateName;

    const res = await interviewService.sendInviteEmail({
      candidate_id: generatedCandidateId || undefined,
      candidate_email: targetEmail,
      candidate_name: targetName,
      job_title: newInterviewRole,
      interview_url: generatedInterviewLink,
      expires_at: generatedExpiresAt || undefined,
    });

    if (res.success) {
      setEmailSendingState("sent");
      const sentTime = new Date().toISOString();
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === generatedCandidateId || c.email === targetEmail
            ? { ...c, email_status: "sent", email_sent_at: sentTime, email_error: undefined }
            : c
        )
      );
      toast({
        title: "Invitation Email Dispatched",
        description: `Formal interview invitation sent to ${targetEmail}.`,
      });
    } else {
      setEmailSendingState("failed");
      const errReason = res.error || "Cannot reach the email server";
      setEmailErrorMessage(errReason);
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === generatedCandidateId || c.email === targetEmail
            ? { ...c, email_status: "failed", email_error: errReason }
            : c
        )
      );
      toast({
        variant: "destructive",
        title: "Email Dispatch Failed",
        description: errReason,
      });
    }
  };

  return (
    <div className="bg-[var(--bg)] min-h-screen font-['Chivo',sans-serif] text-[var(--text)] antialiased">
      {/* ─────────────────────────────────────────────────────────────
          SIDEBAR NAVIGATION (Stitch Spec: 288px fixed left)
      ───────────────────────────────────────────────────────────── */}
      <Sidebar 
        candidateCount={candidates.length} 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
      />

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA (Offset by 288px)
      ───────────────────────────────────────────────────────────── */}
      <div className="pl-0 md:pl-72 flex flex-col min-h-screen">
        {/* TOP BAR / HEADER */}
        <header className="fixed top-0 left-0 md:left-72 right-0 h-16 bg-[var(--surface)]/85 backdrop-blur-xl z-40 flex items-center justify-between px-4 sm:px-8 border-b border-[var(--border)] shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
          {/* Breadcrumb Status & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-alt)] transition-colors shadow-sm shrink-0"
              aria-label="Open sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <span className="text-xs uppercase text-[var(--text-muted)] font-semibold tracking-wider font-mono hidden sm:inline">
              Workspace
            </span>
            <span className="text-[var(--border)] hidden sm:inline">/</span>
            <span className="text-xs font-semibold text-[var(--text)] capitalize font-['Plus_Jakarta_Sans',sans-serif]">
              {activeTab === "job-roles" ? "Job Roles" : activeTab === "help" ? "Help & Support" : activeTab}
            </span>
            <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--primary-soft)]/25 text-[var(--text)] text-xs font-medium shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
              AI Evaluation Engine Active
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center group">
              <span className="material-symbols-outlined absolute left-3 text-[var(--text-muted)] text-[18px] group-hover:text-[var(--primary)] transition-colors pointer-events-none">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search candidate, role, skill..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 pl-9 pr-14 bg-white rounded-lg text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none shadow-sm border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] w-64 sm:w-72 transition-all"
              />
              <div 
                onClick={() => setIsCommandPaletteOpen(true)}
                className="absolute right-2.5 flex items-center gap-0.5 cursor-pointer"
                title="Open Command Palette (Ctrl+K)"
              >
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-[var(--text-muted)] bg-[var(--surface-alt)] border border-[var(--border)] rounded shadow-xs hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
                  {typeof navigator !== "undefined" && navigator.platform?.toUpperCase().indexOf("MAC") >= 0 ? "⌘K" : "Ctrl K"}
                </kbd>
              </div>
            </div>

            {/* Notification Bell with Dropdown Popover */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={isNotificationsOpen}
                onClick={() => setIsNotificationsOpen(prev => !prev)}
                className={`relative w-9 h-9 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-all shadow-sm cursor-pointer ${
                  isNotificationsOpen ? "ring-2 ring-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]" : ""
                }`}
                title="Notifications"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotificationsOpen && (
                <div 
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-[var(--border)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                  role="dialog"
                  aria-label="Notification center"
                >
                  {/* Header */}
                  <div className="p-3.5 px-4 border-b border-[var(--border)] flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <span className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-sm text-[var(--text)]">Notifications</span>
                      {unreadNotificationsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                          {unreadNotificationsCount} unread
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                          All read
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsNotificationsOpen(false)}
                        className="w-6 h-6 rounded-md hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Close"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-white">
                      <button
                        type="button"
                        onClick={() => setNotificationsFilter("all")}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          notificationsFilter === "all"
                            ? "bg-[var(--primary)] text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        All ({notifications.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationsFilter("unread")}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          notificationsFilter === "unread"
                            ? "bg-[var(--primary)] text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        Unread ({unreadNotificationsCount})
                      </button>
                    </div>
                  )}

                  {/* Notification List */}
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-10 px-4 text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                          <span className="material-symbols-outlined text-2xl">notifications_off</span>
                        </div>
                        <p className="text-xs text-slate-700 font-semibold">
                          {notificationsFilter === "unread" ? "No unread notifications" : "No notifications yet"}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {notificationsFilter === "unread" ? "You have read all pipeline alerts." : "Pipeline updates and alerts will appear here."}
                        </p>
                      </div>
                    ) : (
                      filteredNotifications.map((n) => {
                        const iconBg =
                          n.type === "success" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                          n.type === "warning" ? "bg-amber-50 text-amber-600 border-amber-200" :
                          n.type === "urgent" ? "bg-rose-50 text-rose-600 border-rose-200" :
                          "bg-sky-50 text-sky-600 border-sky-200";

                        const iconName =
                          n.type === "success" ? "task_alt" :
                          n.type === "warning" ? "warning" :
                          n.type === "urgent" ? "error" :
                          "info";

                        return (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3.5 px-4 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors relative group ${
                              n.unread ? "bg-blue-50/25" : ""
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${iconBg}`}>
                              <span className="material-symbols-outlined text-[18px]">{iconName}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <h4 className={`text-xs truncate ${n.unread ? "text-slate-900 font-bold" : "text-slate-700 font-semibold"}`}>
                                  {n.title}
                                </h4>
                                <span className="text-[10px] text-slate-400 shrink-0 font-medium">{n.time}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                                {n.message}
                              </p>
                              {n.candidateName && (
                                <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[var(--primary)] group-hover:underline">
                                  <span>View Scorecard</span>
                                  <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                                </div>
                              )}
                            </div>
                            {n.unread && (
                              <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0 self-center" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="p-2.5 px-4 border-t border-[var(--border)] bg-slate-50/70 flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => setNotifications([])}
                        className="text-slate-500 hover:text-rose-600 transition-colors font-medium cursor-pointer"
                      >
                        Clear all
                      </button>
                      <span className="text-slate-400 text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        AI Pipeline Monitoring Active
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Primary Action Button: + New Interview (Requirement 1) */}
            <button
              onClick={() => setIsNewInterviewModalOpen(true)}
              className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>+ New Interview</span>
            </button>
          </div>
        </header>

        {/* MAIN BODY CONTAINER - with bottom padding so floating bulk bar never obscures content (Requirement 5) */}
        <main className="pt-20 px-4 sm:px-8 pb-40 max-w-[1440px] w-full mx-auto flex flex-col gap-8">
          {/* ─────────────────────────────────────────────────────────────
              GREETING & PIPELINE HERO BAR
          ───────────────────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl lg:text-3xl text-[var(--text)] font-extrabold tracking-tight">
                  {activeTab === "candidates" && "Candidate Pipeline"}
                  {activeTab === "job-roles" && "Active Job Roles"}
                  {activeTab === "reports" && "Recruitment Reports"}
                  {activeTab === "settings" && "Workspace Settings"}
                  {activeTab === "help" && "Help & Documentation"}
                  {activeTab === "overview" && `${getGreeting()}, Alex.`}
                </h1>
                {/* Requirement 6: Replaced LIVE HUD with simple Live indicator */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Requirement 3 & 4: Secondary Button: Upload Resumes (outline, same h-9/rounded-lg, RBAC) */}
              <button
                onClick={() => {
                  if (!canUploadResumes) {
                    toast({
                      title: "Access Restricted",
                      description: "Only recruiters, hiring managers, and administrators can upload resumes.",
                      variant: "destructive"
                    });
                    return;
                  }
                  setIsUploadModalOpen(true);
                }}
                disabled={!canUploadResumes}
                className={`h-9 px-4 rounded-lg font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] ${
                  canUploadResumes 
                    ? "border border-[var(--border)] bg-white hover:bg-[var(--surface-alt)] text-[var(--text)]" 
                    : "border border-[var(--border)] bg-gray-100 text-[var(--text-muted)] cursor-not-allowed opacity-60"
                }`}
                title={canUploadResumes ? "Batch upload PDF/DOCX resumes (max 5 MB) for AI screening" : "Upload requires Recruiter role or higher"}
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                <span>Upload Resumes</span>
              </button>

              {/* Requirement 1 & 4: Single Primary Button: + New Interview (solid, same h-9/rounded-lg) */}
              <button
                onClick={() => setIsNewInterviewModalOpen(true)}
                className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>+ New Interview</span>
              </button>

              {/* Requirement 6: Recruiter-only Test Interview (Demo) */}
              {shouldShowDemoRoom && (
                <button
                  onClick={() => navigate("/interview/demo-sandbox", { state: { isDemo: true } })}
                  className="h-9 px-3.5 rounded-lg border border-dashed border-[var(--primary-soft)]/60 bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--primary)] font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-[0.98]"
                  title="Direct developer/admin sandbox room"
                >
                  <span className="material-symbols-outlined text-[16px]">science</span>
                  <span>Test Interview (Demo)</span>
                </button>
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 2: DASHBOARD KPI METRIC CARDS (4-Column Bento Grid)
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "overview" || activeTab === "candidates" || activeTab === "reports" || activeTab === "job-roles") && (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Metric 1: Total Candidates */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col justify-between hover:shadow-md hover:border-[var(--primary-soft)] transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold font-mono">
                    Total Candidates
                  </span>
                  <div className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[var(--text)]">
                    {totalCandidates}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/25/60 text-[var(--primary)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">group</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[var(--primary-soft)]/60 text-[var(--primary)] text-[0.6875rem] font-bold">
                  <span className="material-symbols-outlined text-[12px]">trending_up</span>{currentMetrics.totalTrend.split(" ")[0]}
                </span>
                <span className="text-[0.6875rem] text-[var(--text-muted)]">{currentMetrics.totalTrend.split(" ").slice(1).join(" ")}</span>
              </div>
            </div>

            {/* Metric 2: Video Interviews Completed */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col justify-between hover:shadow-md hover:border-[var(--primary-soft)] transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold font-mono">
                    Video Interviews Completed
                  </span>
                  <div className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[var(--text)]">
                    {completedInterviews}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/50 text-[var(--primary)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">video_call</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[var(--primary-soft)]/60 text-[var(--primary)] text-[0.6875rem] font-bold">
                  <span className="material-symbols-outlined text-[12px]">trending_up</span>{currentMetrics.completedTrend.split(" ")[0]}
                </span>
                <span className="text-[0.6875rem] text-[var(--text-muted)]">{currentMetrics.completedTrend.split(" ").slice(1).join(" ")}</span>
              </div>
            </div>

            {/* Metric 3: Avg Interview Score */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col justify-between hover:shadow-md hover:border-[var(--primary-soft)] transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold font-mono">
                    Avg Interview Score
                  </span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[var(--text)]">
                      {avgScore}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">/ 100</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-alt)]/60 text-[var(--text-muted)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">stars</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[0.6875rem] text-[var(--text-muted)]">Across {currentMetrics.label.toLowerCase()}</span>
                <div className="w-16 h-2 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--primary)] rounded-full"
                    style={{ width: `${Math.min(100, parseFloat(avgScore) || 75)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 4: Completion Rate */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col justify-between hover:shadow-md hover:border-[var(--primary-soft)] transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[0.6875rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold font-mono">
                    Completion Rate
                  </span>
                  <div className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[var(--text)]">
                    {completionRate}%
                  </div>
                </div>
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-[var(--surface-alt)]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="text-[var(--primary)]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray={`${completionRate}, 100`}
                      strokeLinecap="round"
                      strokeWidth="3.2"
                    />
                  </svg>
                  <span className="material-symbols-outlined absolute text-[16px] text-[var(--primary)]">
                    verified
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[0.6875rem] text-[var(--text-muted)]">Candidate participation</span>
                <span className={`text-[0.6875rem] ${getCompletionBadge(Number(completionRate)).colorClass}`}>
                  {getCompletionBadge(Number(completionRate)).label}
                </span>
              </div>
            </div>
          </section>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 3: ACTIVE JOB ROLES
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "overview" || activeTab === "job-roles") && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[var(--text)]">
                  Active Job Roles
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] text-xs font-semibold font-mono">
                  {UNIFIED_PIPELINE_METRICS.activeRoles.length} Openings
                </span>
              </div>
              {/* Requirement 5: Show Clear Filter only when a role/status/search filter is active and resets everything */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs text-[var(--primary)] hover:underline font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Clear Filter</span>
                  {selectedRoleFilter !== "All Roles" && (
                    <span className="text-[var(--text-muted)] font-normal">({selectedRoleFilter})</span>
                  )}
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {UNIFIED_PIPELINE_METRICS.activeRoles.map((item) => {
                const percent = Math.round((item.completedInterviews / item.totalCandidates) * 100);
                const isSelected = selectedRoleFilter === item.role;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectRoleCard(item.role)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/40 border-[var(--primary)] ring-2 ring-[var(--primary)]/30 shadow-sm"
                        : "bg-white border-[var(--border)] hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary-soft)]/40 text-[var(--primary)] text-[0.6875rem] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                          Active
                        </span>
                        <span className="material-symbols-outlined text-[var(--text-muted)] text-[18px]">{item.icon}</span>
                      </div>
                      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)] mt-1">
                        {item.role}
                      </h3>
                      <span className="text-[0.6875rem] text-[var(--text-muted)]">{item.department}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[0.6875rem] text-[var(--text-muted)] font-mono">
                        <span>{item.completedInterviews} / {item.totalCandidates} Interviews</span>
                        <span className="font-bold text-[var(--primary)]">{percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 4: CANDIDATE SCREENING & MANAGEMENT TABLE
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "overview" || activeTab === "candidates") && (
          <section id="candidates-table-section" className="p-6 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col gap-5 scroll-mt-24">
            {/* Table Header & Filter Tabs */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[var(--text)]">
                    Recent Candidates
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Review AI video interview recordings, scorecards, and real-time adaptive probes.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Filter Role:</span>
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => {
                      updateFilterParams({ role: e.target.value, page: 1 });
                    }}
                    className="h-8 px-2.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] outline-none font-medium cursor-pointer"
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filter Tabs (All / Completed / In Progress / Pending Review / Scheduled / Shortlisted / Rejected) */}
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl overflow-x-auto max-w-full">
                  {(["All", "Completed", "In Progress", "Pending Review", "Scheduled", "Shortlisted", "Rejected"] as const).map((tab) => {
                    const isActive = tableTab === tab;
                    const count = tabCounts[tab] ?? 0;
                    const isZero = count === 0;

                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          updateFilterParams({ status: tab, page: 1 });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                          isActive
                            ? "bg-[var(--primary)] text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                        }`}
                      >
                        <span>{tab}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full transition-opacity ${
                          isActive
                            ? isZero
                              ? "bg-white/20 text-white/60"
                              : "bg-white/20 text-white font-bold"
                            : isZero
                            ? "bg-slate-200/50 text-slate-400 opacity-60"
                            : "bg-slate-200/80 text-slate-700 font-bold"
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Page Size Select & Showing X-Y of Z (Requirement 8) */}
                <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
                  <span className="font-medium text-[var(--text-muted)]">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value, 10);
                      updateFilterParams({ pageSize: newSize, page: 1 });
                    }}
                    className="h-7 px-2 bg-[var(--surface-alt)] border border-[var(--border)] rounded-md text-xs text-[var(--text)] font-semibold cursor-pointer outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                  <span className="text-[var(--text-muted)] ml-1 font-mono">
                    {totalFilteredCount === 0
                      ? "Showing 0 of 0"
                      : `Showing ${fromIndex}-${toIndex} of ${totalFilteredCount}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Candidate Table Container with Sticky Header */}
            <div className="overflow-x-auto -mx-6 px-6 max-h-[640px] overflow-y-auto w-full">
              <table className="w-full text-left border-collapse table-auto sm:table-fixed">
                <thead className="sticky top-0 z-10 bg-[var(--surface)] text-[var(--text-muted)] font-mono text-[0.6875rem] uppercase tracking-wider shadow-xs">
                  <tr>
                    {/* Enlarged Select All Checkbox */}
                    <th className="py-3 px-3 rounded-l-xl w-10 text-center">
                      <label className="p-2.5 -m-2.5 inline-flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          aria-label="Select all candidates"
                          checked={isAllSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isIndeterminate;
                          }}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer accent-[var(--primary)]"
                        />
                      </label>
                    </th>
                    <th className="py-3 px-3 font-bold w-[220px]">Candidate</th>
                    <th className="py-3 px-3 font-bold w-[160px]">Role</th>
                    <th className="py-3 px-3 font-bold w-[95px]">Type</th>
                    <th className="py-3 px-3 font-bold w-[115px]">Status</th>
                    {/* Sortable AI Score Header */}
                    <th className="py-3 px-3 font-bold w-[165px]">
                      <button
                        type="button"
                        onClick={() => handleToggleSort("score")}
                        className={`inline-flex items-center gap-1 hover:text-[var(--primary)] font-bold uppercase transition-colors ${
                          sortField === "score" ? "text-[var(--primary)]" : ""
                        }`}
                        title="Sort by AI Score"
                      >
                        <span>AI Score & Verdict</span>
                        <span className="material-symbols-outlined text-[14px]">
                          {sortField === "score"
                            ? sortOrder === "asc"
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"}
                        </span>
                      </button>
                    </th>
                    {/* Sortable Date / Progress Header */}
                    <th className="py-3 px-3 font-bold w-[130px] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleSort("date")}
                        className={`inline-flex items-center gap-1 hover:text-[var(--primary)] font-bold uppercase transition-colors ${
                          sortField === "date" ? "text-[var(--primary)]" : ""
                        }`}
                        title="Sort by Date"
                      >
                        <span>Date / Progress</span>
                        <span className="material-symbols-outlined text-[14px]">
                          {sortField === "date"
                            ? sortOrder === "asc"
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"}
                        </span>
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right rounded-r-xl font-bold w-[140px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-alt)]/60 text-xs font-sans">
                  {isCandidatesLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className="h-16 animate-pulse border-b border-[var(--surface-alt)]/40">
                        <td className="py-3 px-3 text-center"><div className="w-4 h-4 bg-slate-200 rounded mx-auto" /></td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                            <div className="space-y-1.5 w-32">
                              <div className="h-3 bg-slate-200 rounded w-24" />
                              <div className="h-2.5 bg-slate-100 rounded w-20" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3"><div className="h-3 bg-slate-200 rounded w-24" /></td>
                        <td className="py-3 px-3"><div className="h-5 bg-slate-200 rounded-full w-16" /></td>
                        <td className="py-3 px-3"><div className="h-5 bg-slate-200 rounded-full w-20" /></td>
                        <td className="py-3 px-3"><div className="h-5 bg-slate-200 rounded w-24" /></td>
                        <td className="py-3 px-3"><div className="h-3 bg-slate-200 rounded w-20" /></td>
                        <td className="py-3 px-3 text-right"><div className="h-7 bg-slate-200 rounded w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : candidatesError ? (
                    <tr>
                      <td colSpan={8} className="py-12 px-4 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center py-4">
                          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3.5 shadow-sm">
                            <span className="material-symbols-outlined text-3xl">error</span>
                          </div>
                          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[var(--text)] mb-1">
                            Error loading candidates
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed font-sans">
                            {candidatesError}
                          </p>
                          <button
                            type="button"
                            onClick={refreshCandidates}
                            className="h-8 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                            <span>Retry</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 px-4 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center py-4">
                          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-alt)] text-[var(--primary)] flex items-center justify-center mb-3.5 shadow-sm">
                            <span className="material-symbols-outlined text-3xl">filter_alt_off</span>
                          </div>
                          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[var(--text)] mb-1">
                            No candidates match these filters
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed font-sans">
                            No candidate profiles matched your current criteria
                            {debouncedSearch && ` for "${debouncedSearch}"`}
                            {selectedRoleFilter !== "All Roles" && ` in ${selectedRoleFilter}`}
                            {tableTab !== "All" && ` with status "${tableTab}"`}.
                          </p>
                          <button
                            type="button"
                            onClick={handleClearAllFilters}
                            className="h-8 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                            <span>Clear filters</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((cand) => {
                      const isSelected = selectedCandidateIds.includes(cand.id);
                      const verdict = getAIVerdict(cand);
                      return (
                      <tr 
                        key={cand.id}
                        onClick={() => setSelectedCandidateForScorecard(cand)}
                        className={`transition-colors group h-16 cursor-pointer border-b border-[var(--surface-alt)]/40 ${
                          isSelected ? "bg-[var(--primary-soft)]/25/25 hover:bg-[var(--primary-soft)]/25/35" : "hover:bg-[var(--surface-alt)]/50"
                        }`}
                      >
                        {/* Checkbox Cell - stopPropagation */}
                        <td 
                          className="py-3 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="p-2.5 -m-2.5 inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              aria-label={`Select candidate ${cand.name}`}
                              checked={isSelected}
                              onChange={() => handleToggleSelectCandidate(cand.id)}
                              className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer accent-[var(--primary)]"
                            />
                          </label>
                        </td>

                        {/* Candidate Cell (Deterministic Avatar + Name + WCAG AA Email) */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5 min-w-0 max-w-[210px]">
                            <CandidateAvatar name={cand.name} avatarUrl={cand.avatarUrl} />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span 
                                className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-sm text-[var(--text)] truncate group-hover:text-[var(--primary)] transition-colors"
                                title={cand.name}
                              >
                                {cand.name}
                              </span>
                              <span 
                                className="text-[11px] text-[var(--text-muted)] truncate font-sans block"
                                title={cand.email}
                              >
                                {cand.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role Cell */}
                        <td className="py-3 px-3 text-[var(--text)] font-medium font-sans">
                          <span className="truncate block max-w-[150px]" title={cand.role}>
                            {cand.role}
                          </span>
                        </td>

                        {/* Split Column 1: Type (AI Async | Live Video) */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <TypeBadge type={cand.type} />
                        </td>

                        {/* Split Column 2: Status (Scheduled | In Progress | Completed) */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <StatusBadge status={cand.status} />
                            {cand.status === "Scheduled" && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                  cand.email_status === "sent"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : cand.email_status === "failed"
                                    ? "bg-red-50 text-red-800 border-red-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                                title={
                                  cand.email_status === "failed"
                                    ? cand.email_error || "Email delivery failed"
                                    : cand.email_status === "sent"
                                    ? `Invitation delivered${cand.email_sent_at ? " at " + new Date(cand.email_sent_at).toLocaleTimeString() : ""}`
                                    : "Email invitation not yet dispatched"
                                }
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  {cand.email_status === "sent" ? "mark_email_read" : cand.email_status === "failed" ? "error" : "schedule_send"}
                                </span>
                                <span>
                                  {cand.email_status === "sent" ? "Email Sent" : cand.email_status === "failed" ? "Email Failed" : "Email Pending"}
                                </span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* AI Score & Verdict + Inline Flag Icon & Popover */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {cand.score > 0 ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[var(--text)] font-bold font-mono text-xs">
                                <span>{cand.score}</span>
                                <span className="text-slate-500 font-normal">/100</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">—</span>
                            )}

                            {/* Inline Flag Icon & Count with Click Popover (Requirement 7) */}
                            {cand.flags && cand.flags.length > 0 && (() => {
                              const normFlags = normalizeFlags(cand.flags);
                              return (
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                                        title="Click to view proctoring flags"
                                        aria-label="View proctoring flags"
                                      >
                                        <span className="text-xs leading-none">🚩</span>
                                        <span className="font-mono">{normFlags.length}</span>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                      className="w-80 p-3 bg-white border border-[var(--border)] rounded-xl shadow-xl z-50 text-xs font-sans"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
                                        <div className="flex items-center gap-1.5 font-bold text-amber-800 text-xs">
                                          <span className="material-symbols-outlined text-[16px] text-amber-600">flag</span>
                                          <span>Proctoring Signals ({normFlags.length})</span>
                                        </div>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-medium">
                                          Review Needed
                                        </span>
                                      </div>
                                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {normFlags.map((flag, idx) => (
                                          <div key={idx} className="p-2 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)]/60 text-left space-y-1">
                                            <div className="flex items-center justify-between">
                                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--text)] capitalize">
                                                <span className="material-symbols-outlined text-[13px] text-[var(--accent-strong)]">
                                                  {flag.type === "tab switch" ? "tab" : flag.type === "face not visible" ? "visibility_off" : flag.type === "multiple people" ? "groups" : "mic_off"}
                                                </span>
                                                {flag.type}
                                              </span>
                                              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-white px-1.5 py-0.5 rounded border border-[var(--border)]/40">
                                                {flag.time}
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                              {flag.reason}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              );
                            })()}

                            {/* AI Verdict Badge (Devina Roy shows no duplicate badge; Flagged shows Review Needed) */}
                            {verdict && (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] shadow-2xs ${verdict.badgeClass}`}
                              >
                                <span className="material-symbols-outlined text-[13px]">{verdict.icon}</span>
                                <span>{verdict.label}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date / Progress Column (No-wrap, with Q4/8 mini progress indicator) */}
                        <td className="py-3 px-3 whitespace-nowrap min-w-[130px] font-sans">
                          {cand.status === "In Progress" && cand.progress ? (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-amber-700 text-xs">In Progress</span>
                              <span className="px-1.5 py-0.5 rounded bg-[var(--primary-soft)]/20 text-[var(--primary)] font-mono text-[10px] font-bold">
                                {cand.progress}
                              </span>
                              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                <div className="h-full bg-amber-500 rounded-full w-1/2" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)] text-xs font-sans whitespace-nowrap">
                              {cand.completedAt}
                            </span>
                          )}
                        </td>

                        {/* Action Buttons (Fixed w-[140px], icon button for Play, primary for Review) */}
                        <td 
                          className="py-3 px-3 text-right whitespace-nowrap w-[140px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {/* Completed & Shortlisted Candidate Actions */}
                            {(cand.status === "Completed" || cand.status === "Shortlisted") && (
                              <>
                                {cand.recordingUrl && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRecordingModalCandidate(cand);
                                    }}
                                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] transition-colors shadow-2xs cursor-pointer active:scale-95"
                                    title="Play Recording"
                                    aria-label="Play Recording"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">play_circle</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCandidateForScorecard(cand);
                                  }}
                                  className="h-8 px-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                                  title="Review candidate scorecard"
                                >
                                  <span className="material-symbols-outlined text-[15px]">assignment</span>
                                  <span>Review</span>
                                </button>
                              </>
                            )}

                            {/* Rejected Candidate Actions */}
                            {cand.status === "Rejected" && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCandidateForScorecard(cand);
                                  }}
                                  className="h-8 px-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-alt)] text-[var(--text)] text-xs font-semibold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
                                  title="Review candidate"
                                >
                                  <span className="material-symbols-outlined text-[15px]">assignment</span>
                                  <span>Review</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await undoReject({ [cand.id]: "Completed" });
                                  }}
                                  className="h-8 px-2.5 rounded-lg bg-[var(--surface-alt)] hover:bg-slate-200 text-[var(--text)] text-xs font-semibold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
                                  title="Restore candidate"
                                >
                                  <span className="material-symbols-outlined text-[15px]">undo</span>
                                  <span>Restore</span>
                                </button>
                              </>
                            )}

                            {/* Pending Review Candidate Actions */}
                            {cand.status === "Pending Review" && (
                              <>
                                {cand.recordingUrl && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRecordingModalCandidate(cand);
                                    }}
                                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] transition-colors shadow-2xs cursor-pointer active:scale-95"
                                    title="Play Recording"
                                    aria-label="Play Recording"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">play_circle</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDecisionModalCandidate(cand);
                                  }}
                                  className="h-8 px-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                                  title="Make hiring decision"
                                >
                                  <span className="material-symbols-outlined text-[15px]">gavel</span>
                                  <span>Decide</span>
                                </button>
                              </>
                            )}

                            {/* Live Video / In Progress Candidate Indicator (Recruiter does not join candidate session) */}
                            {(cand.status === "In Progress" || cand.status === "Live Video") && (
                              <span 
                                className="h-8 px-2.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs"
                                title="Candidate is currently taking the interview"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>In Session</span>
                              </span>
                            )}

                            {/* Scheduled Candidate Actions: Copy link, Resend email, Extend expiry, Cancel */}
                            {(cand.status === "Scheduled" || cand.status === "Screened") && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyCandidateLink(cand);
                                  }}
                                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] transition-colors shadow-2xs cursor-pointer active:scale-95 bg-white"
                                  title="Copy Interview Link"
                                  aria-label="Copy Interview Link"
                                >
                                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResendEmail(cand);
                                  }}
                                  className={`w-8 h-8 rounded-lg inline-flex items-center justify-center border transition-colors shadow-2xs cursor-pointer active:scale-95 bg-white ${
                                    cand.email_status === "failed"
                                      ? "text-red-700 hover:bg-red-50 border-red-300"
                                      : "text-sky-700 hover:bg-sky-50 border-[var(--border)]"
                                  }`}
                                  title={
                                    cand.email_status === "failed"
                                      ? `Retry Invitation Email (Failed: ${cand.email_error || "Delivery error"})`
                                      : "Resend Email Invitation"
                                  }
                                  aria-label="Resend Email Invitation"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {cand.email_status === "failed" ? "refresh" : "mail"}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExtendExpiry(cand);
                                  }}
                                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-amber-700 hover:bg-amber-50 border border-[var(--border)] transition-colors shadow-2xs cursor-pointer active:scale-95 bg-white"
                                  title="Extend Expiry (+48 Hours)"
                                  aria-label="Extend Expiry"
                                >
                                  <span className="material-symbols-outlined text-[16px]">update</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelInterview(cand);
                                  }}
                                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 border border-[var(--border)] transition-colors shadow-2xs cursor-pointer active:scale-95 bg-white"
                                  title="Cancel Scheduled Interview"
                                  aria-label="Cancel Interview"
                                >
                                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer (Requirement 8) */}
            {totalFilteredCount > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)] font-sans">
                <span className="font-mono">
                  Showing <strong className="text-[var(--text)] font-semibold">{fromIndex}</strong> to{" "}
                  <strong className="text-[var(--text)] font-semibold">{toIndex}</strong> of{" "}
                  <strong className="text-[var(--text)] font-semibold">{totalFilteredCount}</strong> candidates
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => updateFilterParams({ page: Math.max(1, safePage - 1) })}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-1 cursor-pointer"
                    aria-label="Previous Page"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      if (
                        totalPages > 7 &&
                        pageNum !== 1 &&
                        pageNum !== totalPages &&
                        Math.abs(pageNum - safePage) > 1
                      ) {
                        if (pageNum === 2 || pageNum === totalPages - 1) {
                          return (
                            <span key={`ellipsis-${pageNum}`} className="px-1 text-slate-400">
                              ...
                            </span>
                          );
                        }
                        return null;
                      }

                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => updateFilterParams({ page: pageNum })}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            safePage === pageNum
                              ? "bg-[var(--primary)] text-white shadow-xs"
                              : "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--surface-alt)]"
                          }`}
                          aria-label={`Go to page ${pageNum}`}
                          aria-current={safePage === pageNum ? "page" : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => updateFilterParams({ page: Math.min(totalPages, safePage + 1) })}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-1 cursor-pointer"
                    aria-label="Next Page"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </section>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 5: ANALYTICS & AI INSIGHTS ROW (3-Column Bento Grid)
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "overview" || activeTab === "reports") && (
          <section id="analytics-chart-section" className="grid grid-cols-1 lg:grid-cols-3 gap-5 scroll-mt-24">
            {/* Chart Column: Interview Activity (Responsive Recharts Area Chart) */}
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                    Interview Activity
                  </h3>
                  <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-slate-100 text-[var(--text-muted)] font-medium">
                    Last 30 Days
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-sans">
                  Interview completion velocity across tracks ({UNIFIED_PIPELINE_METRICS.completedInterviews} completed).
                </p>
              </div>

              {/* Requirement 6: Full-width responsive Recharts with Y-axis, tooltips & Target: 30/wk reference */}
              <div className="w-full h-44 my-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={UNIFIED_PIPELINE_METRICS.weeklyActivity.map(w => ({
                      week: w.week,
                      interviews: w.count,
                      target: 30
                    }))}
                    margin={{ top: 12, right: 12, left: -22, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="interviewAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8DB9F0" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#8DB9F0" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DAD9EE" strokeOpacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="week"
                      tickLine={false}
                      axisLine={{ stroke: "#DAD9EE", strokeOpacity: 0.6 }}
                      tick={{ fontSize: 11, fill: "#5B6384", fontFamily: "sans-serif" }}
                    />
                    <YAxis
                      domain={[0, 35]}
                      ticks={[0, 10, 20, 30]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#5B6384", fontFamily: "monospace" }}
                    />
                    <ReferenceLine
                      y={30}
                      stroke="#F5B69E"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: "Target: 30/wk",
                        position: "top",
                        fill: "#D9805F",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "monospace"
                      }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        const diff = data.interviews - 30;
                        return (
                          <div className="bg-[#1B2340] text-white px-3 py-2 rounded-xl shadow-soft-lg border border-white/10 text-xs flex flex-col gap-1 font-sans">
                            <div className="flex items-center justify-between gap-3 font-bold">
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#8DB9F0]" />
                                {data.week}
                              </span>
                              <span className="text-[#8DB9F0] font-mono">{data.interviews} interviews</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-[10px] text-slate-300 font-mono">
                              <span>vs Target (30/wk):</span>
                              <span className={diff >= 0 ? "text-emerald-400 font-semibold" : "text-amber-300 font-semibold"}>
                                {diff >= 0 ? `+${diff}` : diff} ({Math.round((data.interviews / 30) * 100)}%)
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="interviews"
                      stroke="#2F6FBF"
                      strokeWidth={2.5}
                      fill="url(#interviewAreaGrad)"
                      activeDot={{ r: 6, fill: "#2F6FBF", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-[var(--text-muted)] font-sans">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                  Velocity: +33% wk/wk
                </span>
                <span className="font-mono text-[11px] text-[var(--primary)] font-semibold">Target: 30/wk</span>
              </div>
            </div>

            {/* Requirement 7: AI Hiring Insights (No top gap, semantic styles: positive/warning/info, action links) */}
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                    AI Hiring Insights
                  </h3>
                  <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">psychology</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-sans">Patterns identified across recent adaptive interviews.</p>
              </div>

              <div className="my-2.5 flex flex-col gap-2.5">
                {/* Positive Insight (Green / Emerald) */}
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3 transition-all hover:shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-[var(--success)]/15 text-[var(--success)] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950 truncate">Strong Technical Communication</span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded shrink-0">Positive</span>
                    </div>
                    <p className="text-[11px] text-emerald-900 leading-snug mt-0.5 font-sans">
                      68% of evaluated candidates demonstrated clear conceptual clarity in architectural reasoning.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setTableTab("Completed");
                        setSelectedRoleFilter("All Roles");
                      }}
                      className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 mt-1 hover:underline text-left w-fit"
                    >
                      <span>View candidates</span>
                      <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                    </button>
                  </div>
                </div>

                {/* Warning Insight (Amber) */}
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 transition-all hover:shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-[var(--primary-soft)]/20 text-[var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 truncate">Proctoring Signals Flagged</span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded shrink-0">Review</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-snug mt-0.5 font-sans">
                      Tab switches and window focus loss detected in 2 sessions during technical coding rounds.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setTableTab("All");
                        setSearchQuery("Ananya");
                      }}
                      className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 mt-1 hover:underline text-left w-fit"
                    >
                      <span>Review flagged candidates</span>
                      <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                    </button>
                  </div>
                </div>

                {/* Info Insight (Blue / Sky) */}
                <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-start gap-3 transition-all hover:shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-[var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">dynamic_form</span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text)] truncate">Adaptive Probe Agility</span>
                      <span className="text-[10px] font-bold text-[var(--primary)] bg-sky-100/80 px-1.5 py-0.2 rounded shrink-0">Signal</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5 font-sans">
                      Real-time counterfactual follow-ups revealed depth of hands-on experience versus rote memorization.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/interview")}
                      className="text-[11px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] flex items-center gap-1 mt-1 hover:underline text-left w-fit"
                    >
                      <span>Launch AI room</span>
                      <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-[var(--text-muted)] font-sans">
                Updated automatically by Groq Evaluation Engine
              </div>
            </div>

            {/* Requirement 8: Pipeline Conversion Funnel Widget */}
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                    Pipeline Conversion Funnel
                  </h3>
                  {/* Renamed header to prevent confusion with first stage */}
                  <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--primary)] font-bold">
                    16.9% Applied → Final Round
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-sans">
                  Candidate progression across hiring pipeline stages.
                </p>
              </div>

              {/* Stepped Funnel Stages with Single Primary Metric & Secondary Conversion */}
              <div className="my-2.5 flex flex-col gap-3">
                {FUNNEL_DATA.map((item, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div key={item.stage} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs font-sans">
                        <div className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
                          <span className="material-symbols-outlined text-[15px] text-[var(--primary)]">{item.icon}</span>
                          <span>{item.stage}</span>
                        </div>
                        {/* Primary Metric: Count and % of total Applied */}
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-[var(--text)]">{item.count}</span>
                          <span className="text-[11px] text-[var(--text-muted)] font-sans">
                            ({item.overallRate}% of total)
                          </span>
                        </div>
                      </div>

                      {/* Funnel Progress Tier Bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${item.overallRate}%`,
                            backgroundColor: item.color
                          }}
                        />
                      </div>

                      {/* Secondary Metric: Stage-to-stage conversion (Redundant drop label removed) */}
                      {!isFirst && (
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-sans px-0.5">
                          <span>From {FUNNEL_DATA[idx - 1].stage}</span>
                          <span 
                            className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50"
                            title={`${item.conversionRate}% conversion from ${FUNNEL_DATA[idx - 1].stage}`}
                          >
                            {item.conversionRate}% conversion
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-sans">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Conversion Health: Optimal
                </span>
                <span className="text-[var(--primary)] font-medium">
                  {UNIFIED_PIPELINE_METRICS.totalCandidates} Total in Pool
                </span>
              </div>
            </div>
          </section>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SETTINGS VIEW
          ───────────────────────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="flex flex-col gap-6 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column 1: Recruiter Profile & Personal Info */}
                <div className="p-6 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-bold text-base shadow-sm">
                      AM
                    </div>
                    <div>
                      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[var(--text)]">
                        Alex Morgan
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">Lead Technical Recruiter & Hiring Manager</p>
                    </div>
                  </div>
                  <div className="h-[1px] bg-[var(--border)]/20 my-1" />
                  <div className="space-y-3.5">
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Full Name</label>
                      <input 
                        type="text" 
                        defaultValue="Alex Morgan" 
                        className="mt-1 w-full h-9 px-3 bg-[var(--bg)] rounded-lg text-xs text-[var(--text)] border border-[var(--border)] focus:border-[var(--primary)] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Email Address</label>
                      <input 
                        type="email" 
                        defaultValue="alex.morgan@company.com" 
                        className="mt-1 w-full h-9 px-3 bg-[var(--bg)] rounded-lg text-xs text-[var(--text)] border border-[var(--border)] focus:border-[var(--primary)] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Department</label>
                      <input 
                        type="text" 
                        defaultValue="Engineering Recruitment" 
                        className="mt-1 w-full h-9 px-3 bg-[var(--bg)] rounded-lg text-xs text-[var(--text)] border border-[var(--border)] focus:border-[var(--primary)] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Timezone</label>
                      <select className="mt-1 w-full h-9 px-3 bg-[var(--bg)] rounded-lg text-xs text-[var(--text)] border border-[var(--border)] focus:border-[var(--primary)] outline-none">
                        <option value="IST">Asia/Kolkata (IST - UTC+05:30)</option>
                        <option value="PST">America/Los_Angeles (PST - UTC-08:00)</option>
                        <option value="EST">America/New_York (EST - UTC-05:00)</option>
                        <option value="UTC">Coordinated Universal Time (UTC)</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center justify-between mt-auto">
                    <span className="text-xs text-[var(--text-muted)]">Personal details sync across teams</span>
                    <button
                      onClick={() => toast({ title: "Profile Saved", description: "Your workspace profile settings have been updated." })}
                      className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>

                {/* Column 2: Workspace & Assessment Defaults */}
                <div className="p-6 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[var(--primary)] border border-blue-200/60 flex items-center justify-center font-bold text-base shadow-sm">
                      <span className="material-symbols-outlined text-[24px]">tune</span>
                    </div>
                    <div>
                      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[var(--text)]">
                        Interview & Assessment Preferences
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">Default configurations for newly launched interviews</p>
                    </div>
                  </div>
                  <div className="h-[1px] bg-[var(--border)]/20 my-1" />
                  <div className="space-y-3.5">
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Default Interview Room Duration</label>
                      <select className="mt-1 w-full h-9 px-3 bg-[var(--bg)] rounded-lg text-xs text-[var(--text)] border border-[var(--border)] focus:border-[var(--primary)] outline-none">
                        <option value="30">30 Minutes (Recommended)</option>
                        <option value="45">45 Minutes</option>
                        <option value="60">60 Minutes</option>
                      </select>
                    </div>

                    <div className="pt-1 space-y-3">
                      <label className="text-xs font-semibold text-[var(--text)] block">Candidate & Proctoring Controls</label>

                      <label className="flex items-start gap-3 p-2.5 rounded-xl bg-[var(--surface-alt)]/40 border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-alt)]/60 transition-colors">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]" />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[var(--text)]">Automated Candidate Email Invites</span>
                          <span className="text-[11px] text-[var(--text-muted)]">Send 48-hour secure interview link immediately upon creation</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-2.5 rounded-xl bg-[var(--surface-alt)]/40 border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-alt)]/60 transition-colors">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]" />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[var(--text)]">Proctoring Telemetry & Tab-Switch Alerts</span>
                          <span className="text-[11px] text-[var(--text-muted)]">Flag multi-tab activity and audio abnormalities in scorecard</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-2.5 rounded-xl bg-[var(--surface-alt)]/40 border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-alt)]/60 transition-colors">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]" />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[var(--text)]">Instant Scorecard Synthesis</span>
                          <span className="text-[11px] text-[var(--text-muted)]">Compute technical ratings and hire recommendations on interview end</span>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center justify-between mt-auto">
                    <span className="text-xs text-[var(--text-muted)]">Applies to all upcoming sessions</span>
                    <button
                      onClick={() => toast({ title: "Preferences Saved", description: "Assessment room preferences updated successfully." })}
                      className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              HELP & SUPPORT VIEW
          ───────────────────────────────────────────────────────────── */}
          {activeTab === "help" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col gap-2 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/25/70 text-[var(--primary)] flex items-center justify-center font-bold">1</div>
                  <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">Upload Resumes</h4>
                  <p className="text-xs text-[var(--text-muted)]">Upload PDF candidate resumes to parse skills, work history, and calculate JD match scores.</p>
                </div>
                <div className="p-5 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col gap-2 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/25/70 text-[var(--primary)] flex items-center justify-center font-bold">2</div>
                  <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">Filter & Shortlist</h4>
                  <p className="text-xs text-[var(--text-muted)]">Rank applicants using threshold filters and choose top qualified candidates for interview.</p>
                </div>
                <div className="p-5 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col gap-2 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/25/70 text-[var(--primary)] flex items-center justify-center font-bold">3</div>
                  <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">AI Video Interview</h4>
                  <p className="text-xs text-[var(--text-muted)]">Candidate enters the browser interview room with live webcam, voice recognition, and AI questions.</p>
                </div>
                <div className="p-5 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col gap-2 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/25/70 text-[var(--primary)] flex items-center justify-center font-bold">4</div>
                  <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">Review Scorecards</h4>
                  <p className="text-xs text-[var(--text-muted)]">Inspect multi-vector evaluation scorecards, validated strengths, areas to strengthen, and transcripts.</p>
                </div>
              </div>

              {/* Frequently Asked Questions */}
              <div className="p-6 bg-white rounded-2xl shadow-sm border border-[var(--border)] flex flex-col gap-4">
                <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[var(--text)]">
                  Frequently Asked Questions
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                    <h5 className="text-xs font-bold text-[var(--text)]">How does the in-browser interview room work?</h5>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      The interview room uses standard browser WebRTC camera access, Web Speech API or Groq Whisper for speech-to-text, and Deepgram Aura for text-to-speech. No external meeting apps or extensions are required.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                    <h5 className="text-xs font-bold text-[var(--text)]">How do I navigate between sections in the dashboard?</h5>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Use the left navigation sidebar to switch between Overview, Candidates, Interviews, Reports, Job Roles, Settings, and Help & Support at any time.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                    <h5 className="text-xs font-bold text-[var(--text)]">Where do I configure backend API keys?</h5>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Configure your GROQ_API_KEY and MONGO_URI in <code className="px-1.5 py-0.5 rounded bg-[var(--surface-alt)] text-xs">backend/.env</code>, then run the services via <code className="px-1.5 py-0.5 rounded bg-[var(--surface-alt)] text-xs">start_demo.ps1</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          QUICK-SEARCH COMMAND PALETTE MODAL (Ctrl+K / ⌘K)
      ───────────────────────────────────────────────────────────── */}
      {isCommandPaletteOpen && (() => {
        // Build flat array of runnable palette items for keyboard navigation (Arrow keys + Enter)
        const runnableItems: Array<{ id: string; run: () => void }> = [];

        // 1. Quick Actions
        const showQuickActions = !commandPaletteQuery.trim() ||
          "launch new interview upload resume candidate report role room live pipeline analytics".toLowerCase().includes(commandPaletteQuery.toLowerCase());
        
        if (showQuickActions) {
          runnableItems.push({
            id: "qa-launch-room",
            run: () => {
              setIsCommandPaletteOpen(false);
              navigate("/interview");
            }
          });
          runnableItems.push({
            id: "qa-new-interview",
            run: () => {
              setIsCommandPaletteOpen(false);
              setIsNewInterviewModalOpen(true);
            }
          });
          runnableItems.push({
            id: "qa-upload-resumes",
            run: () => {
              setIsCommandPaletteOpen(false);
              setIsUploadModalOpen(true);
            }
          });
          runnableItems.push({
            id: "qa-reports",
            run: () => {
              setIsCommandPaletteOpen(false);
              navigate("/reports");
              setTimeout(() => {
                document.getElementById("analytics-chart-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 120);
            }
          });
          runnableItems.push({
            id: "qa-pipeline",
            run: () => {
              setIsCommandPaletteOpen(false);
              navigate("/candidates");
              setTimeout(() => {
                document.getElementById("candidates-table-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 120);
            }
          });
        }

        // 2. Candidates
        matchingPaletteCandidates.slice(0, 5).forEach(cand => {
          runnableItems.push({
            id: `cand-${cand.id}`,
            run: () => {
              setIsCommandPaletteOpen(false);
              if (cand.status === "Pending Review") {
                setDecisionModalCandidate(cand);
              } else if (cand.status === "Scheduled" || cand.status === "In Progress" || cand.status === "Live Video") {
                handleLaunchInterview(cand);
              } else {
                setSelectedCandidateForScorecard(cand);
              }
            }
          });
        });

        // 3. Job Roles
        matchingPaletteRoles.slice(0, 3).forEach(job => {
          runnableItems.push({
            id: `job-${job.role}`,
            run: () => {
              setIsCommandPaletteOpen(false);
              setSelectedRoleFilter(job.role);
              navigate("/candidates");
              setTimeout(() => {
                document.getElementById("candidates-table-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 120);
            }
          });
        });

        let currentFlatIndex = 0;

        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-150"
            onClick={() => setIsCommandPaletteOpen(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[var(--border)] overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Input Bar with Keyboard Navigation */}
              <div className="p-3.5 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg)]">
                <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">search</span>
                <input
                  ref={commandInputRef}
                  type="text"
                  value={commandPaletteQuery}
                  onChange={(e) => {
                    setCommandPaletteQuery(e.target.value);
                    setPaletteSelectedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setPaletteSelectedIndex(prev => Math.min(prev + 1, Math.max(0, runnableItems.length - 1)));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setPaletteSelectedIndex(prev => Math.max(prev - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const item = runnableItems[paletteSelectedIndex];
                      if (item) item.run();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setIsCommandPaletteOpen(false);
                    }
                  }}
                  placeholder="Search candidates, roles, or type a command..."
                  className="w-full bg-transparent text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none font-medium"
                />
                {commandPaletteQuery && (
                  <button
                    onClick={() => {
                      setCommandPaletteQuery("");
                      setPaletteSelectedIndex(0);
                    }}
                    className="w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center text-[var(--text-muted)] transition-colors"
                    title="Clear query"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
                <kbd className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-md bg-[var(--surface-alt)] text-[var(--text-muted)] border border-[var(--border)]">
                  ESC
                </kbd>
              </div>

              {/* Results Scroll Area */}
              <div className="overflow-y-auto p-3 space-y-4 max-h-[60vh] divide-y divide-[var(--border)]">
                {/* 1. Quick Actions */}
                {showQuickActions && (
                  <div className="space-y-1.5 pt-1">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Quick Actions
                    </div>

                    {/* Action 1: Launch AI Interview Room */}
                    {(() => {
                      const idx = currentFlatIndex++;
                      const isHighlighted = paletteSelectedIndex === idx;
                      return (
                        <button
                          key="qa-launch-room"
                          onClick={() => {
                            setIsCommandPaletteOpen(false);
                            navigate("/interview");
                          }}
                          onMouseEnter={() => setPaletteSelectedIndex(idx)}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-colors group ${
                            isHighlighted ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary-soft)]/40" : "hover:bg-[var(--primary)]/10"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-[16px]">videocam</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary)] flex items-center gap-1.5">
                              <span>Launch AI Interview Room</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[var(--success)]/15 text-[var(--success)] font-bold">
                                Live Room
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">
                              Open the interactive live interview room with AI interviewer
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-300 group-hover:text-[var(--primary)] text-[16px]">
                            arrow_forward
                          </span>
                        </button>
                      );
                    })()}

                    {/* Action 2: + New Interview */}
                    {(() => {
                      const idx = currentFlatIndex++;
                      const isHighlighted = paletteSelectedIndex === idx;
                      return (
                        <button
                          key="qa-new-interview"
                          onClick={() => {
                            setIsCommandPaletteOpen(false);
                            setIsNewInterviewModalOpen(true);
                          }}
                          onMouseEnter={() => setPaletteSelectedIndex(idx)}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-colors group ${
                            isHighlighted ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary-soft)]/40" : "hover:bg-[var(--primary)]/10"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-[16px]">add_circle</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary)]">
                              + New Interview
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">
                              Create single-use 48h invitation link to copy or email
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-300 group-hover:text-[var(--primary)] text-[16px]">
                            arrow_forward
                          </span>
                        </button>
                      );
                    })()}

                    {/* Action 3: Upload Resumes */}
                    {(() => {
                      const idx = currentFlatIndex++;
                      const isHighlighted = paletteSelectedIndex === idx;
                      return (
                        <button
                          key="qa-upload-resumes"
                          onClick={() => {
                            setIsCommandPaletteOpen(false);
                            if (!canUploadResumes) {
                              toast({
                                title: "Access Restricted",
                                description: "Recruiter role or higher required to upload resumes.",
                                variant: "destructive"
                              });
                              return;
                            }
                            setIsUploadModalOpen(true);
                          }}
                          onMouseEnter={() => setPaletteSelectedIndex(idx)}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-colors group ${
                            isHighlighted ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary-soft)]/40" : "hover:bg-[var(--primary)]/10"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary)]">
                              Upload Resumes
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">
                              Parse and batch-screen PDF/DOCX candidate profiles
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-300 group-hover:text-[var(--primary)] text-[16px]">
                            arrow_forward
                          </span>
                        </button>
                      );
                    })()}

                    {/* Action 4: View Analytics & Reports */}
                    {(() => {
                      const idx = currentFlatIndex++;
                      const isHighlighted = paletteSelectedIndex === idx;
                      return (
                        <button
                          key="qa-reports"
                          onClick={() => {
                            setIsCommandPaletteOpen(false);
                            navigate("/reports");
                            setTimeout(() => {
                              document.getElementById("analytics-chart-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 100);
                          }}
                          onMouseEnter={() => setPaletteSelectedIndex(idx)}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-colors group ${
                            isHighlighted ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary-soft)]/40" : "hover:bg-[var(--primary)]/10"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-[16px]">assessment</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary)]">
                              View Analytics & Reports
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">
                              Detailed pipeline conversion metrics and candidate insights
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-300 group-hover:text-[var(--primary)] text-[16px]">
                            arrow_forward
                          </span>
                        </button>
                      );
                    })()}

                    {/* Action 5: Candidate Pipeline */}
                    {(() => {
                      const idx = currentFlatIndex++;
                      const isHighlighted = paletteSelectedIndex === idx;
                      return (
                        <button
                          key="qa-pipeline"
                          onClick={() => {
                            setIsCommandPaletteOpen(false);
                            navigate("/candidates");
                            setTimeout(() => {
                              document.getElementById("candidates-table-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 100);
                          }}
                          onMouseEnter={() => setPaletteSelectedIndex(idx)}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-colors group ${
                            isHighlighted ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary-soft)]/40" : "hover:bg-[var(--primary)]/10"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-[16px]">group</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary)]">
                              Candidate Pipeline Table
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">
                              Review candidate status, actions, and bulk shortlist/export
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-300 group-hover:text-[var(--primary)] text-[16px]">
                            arrow_forward
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                )}

                {/* 2. Matching Candidates */}
                {matchingPaletteCandidates.length > 0 && (
                  <div className="space-y-1.5 pt-3">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                      <span>Candidates</span>
                      <span className="font-mono text-[9px] text-[var(--primary)]">
                        {matchingPaletteCandidates.length} found
                      </span>
                    </div>
                    {matchingPaletteCandidates.slice(0, 5).map((cand) => {
                      const idx = currentFlatIndex++;
                      const isHighlighted = paletteSelectedIndex === idx;

                      return (
                        <button
                          key={cand.id}
                          onClick={() => {
                            setIsCommandPaletteOpen(false);
                            if (cand.status === "Pending Review") {
                              setDecisionModalCandidate(cand);
                            } else if (cand.status === "Scheduled" || cand.status === "In Progress" || cand.status === "Live Video") {
                              handleLaunchInterview(cand);
                            } else {
                              setSelectedCandidateForScorecard(cand);
                            }
                          }}
                          onMouseEnter={() => setPaletteSelectedIndex(idx)}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-colors group ${
                            isHighlighted ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary-soft)]/40" : "hover:bg-[var(--primary)]/10"
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-xs flex items-center justify-center shrink-0">
                            {cand.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--text)] truncate group-hover:text-[var(--primary)] flex items-center gap-2">
                              <span>{cand.name}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                cand.status === "Completed"
                                  ? "bg-[var(--success)]/15 text-[var(--success)]"
                                  : cand.status === "In Progress" || cand.status === "Live Video"
                                  ? "bg-[var(--primary-soft)]/20 text-[var(--primary)]"
                                  : cand.status === "Pending Review"
                                  ? "bg-[var(--accent)]/30 text-[var(--accent-strong)]"
                                  : "bg-[var(--surface-alt)] text-[var(--text-muted)]"
                              }`}>
                                {cand.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">
                              {cand.role} · {cand.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {cand.score > 0 && (
                              <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-md">
                                {cand.score}%
                              </span>
                            )}
                            <span className="text-[10px] font-medium text-[var(--primary)] bg-white border border-[var(--border)] px-2 py-0.5 rounded-md shadow-2xs group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                              {cand.status === "Completed"
                                ? "Scorecard"
                                : cand.status === "Pending Review"
                                ? "Review"
                                : cand.status === "In Progress" || cand.status === "Live Video"
                                ? "Join"
                                : "Start"}
                            </span>
                            <span className="material-symbols-outlined text-slate-300 group-hover:text-[var(--primary)] text-[16px]">
                              chevron_right
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. Matching Active Job Roles */}
                {matchingPaletteRoles.length > 0 && (
                  <div className="space-y-1.5 pt-3">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                      <span>Job Openings</span>
                      <span className="font-mono text-[9px] text-[var(--primary)]">
                        {matchingPaletteRoles.length} active
                      </span>
                    </div>
                    {matchingPaletteRoles.slice(0, 3).map((job) => {
                      const idx = currentFlatIndex++;
                      const isHighlighted = paletteSelectedIndex === idx;

                      return (
                        <button
                          key={job.role}
                          onClick={() => {
                            setIsCommandPaletteOpen(false);
                            setSelectedRoleFilter(job.role);
                            navigate("/candidates");
                            setTimeout(() => {
                              document.getElementById("candidates-table-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 100);
                          }}
                          onMouseEnter={() => setPaletteSelectedIndex(idx)}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-colors group ${
                            isHighlighted ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary-soft)]/40" : "hover:bg-[var(--primary)]/10"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-[var(--surface-alt)] text-[var(--primary)] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[16px]">work</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary)] truncate">
                              {job.role}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {job.department} · {job.completedInterviews ?? job.totalCandidates} interviews
                            </div>
                          </div>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-[var(--text-muted)]">
                            Filter candidates
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Empty state when query matches nothing */}
                {commandPaletteQuery.trim() &&
                  matchingPaletteCandidates.length === 0 &&
                  matchingPaletteRoles.length === 0 && (
                    <div className="py-8 text-center">
                      <span className="material-symbols-outlined text-3xl text-slate-300">
                        manage_search
                      </span>
                      <p className="text-xs font-semibold text-[var(--text)] mt-2">
                        No results for "{commandPaletteQuery}"
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Try searching by candidate name, role title, or skill.
                      </p>
                    </div>
                  )}
              </div>

              {/* Footer Shortcut Legend */}
              <div className="p-2.5 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 font-mono text-[9px] rounded bg-white border border-[var(--border)] shadow-2xs">
                      ↑
                    </kbd>
                    <kbd className="px-1.5 py-0.5 font-mono text-[9px] rounded bg-white border border-[var(--border)] shadow-2xs">
                      ↓
                    </kbd>
                    <span>navigate</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 font-mono text-[9px] rounded bg-white border border-[var(--border)] shadow-2xs">
                      Enter
                    </kbd>
                    <span>select</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 font-mono text-[9px] rounded bg-white border border-[var(--border)] shadow-2xs">
                      ESC
                    </kbd>
                    <span>close</span>
                  </span>
                </div>
                <span className="text-[10px] font-medium text-[var(--primary)]">
                  AI Interview Agent Recruiter Workspace
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          FLOATING BULK-ACTION TOOLBAR (Sticky bottom, centered relative to main area)
      ───────────────────────────────────────────────────────────── */}
      {selectedCandidateIds.length > 0 && (
        <div className="fixed bottom-6 z-40 left-0 md:left-72 right-0 flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto bg-[var(--text)] text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-full overflow-x-auto">
            <div className="flex items-center gap-2 pr-1 shrink-0">
              <span className="px-2 py-0.5 rounded-full bg-[var(--primary)] text-white text-xs font-mono font-bold">
                {selectedCandidateIds.length}
              </span>
              <span className="text-xs font-medium text-slate-300 font-sans">
                candidate{selectedCandidateIds.length > 1 ? "s" : ""} selected
              </span>
            </div>

            <div className="h-5 w-[1px] bg-white/20 shrink-0" />

            <div className="flex items-center gap-2 shrink-0">
              {/* Shortlist Selected - Always enabled when >= 1 candidate selected (Requirement 2) */}
              <div className="relative group/shortlist">
                <button
                  type="button"
                  onClick={handleBulkShortlist}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white active:scale-95"
                  title="Shortlist candidates with completed evaluation reports"
                >
                  <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                  <span>Shortlist Selected</span>
                </button>
              </div>

              {/* Export CSV - Downloads CSV for selected candidates (Requirement 4) */}
              <button
                type="button"
                onClick={handleBulkExportCSV}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                title="Download CSV report for selected candidates"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Export CSV</span>
              </button>

              {/* Reject - Opens Confirmation Dialog (Requirement 3) */}
              <button
                type="button"
                onClick={handleBulkReject}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                title="Reject selected candidates"
              >
                <span className="material-symbols-outlined text-[16px]">person_remove</span>
                <span>Reject</span>
              </button>
            </div>

            <div className="h-5 w-[1px] bg-white/20 shrink-0" />

            <button
              type="button"
              onClick={() => setSelectedCandidateIds([])}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
              title="Clear Selection"
              aria-label="Clear Selection"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          REJECT CONFIRMATION DIALOG (Requirement 3: Count, Names, In-Progress Warning, Loading)
      ───────────────────────────────────────────────────────────── */}
      {isRejectConfirmOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-dialog-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-red-50/50 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">person_remove</span>
              </div>
              <div>
                <h3 id="reject-dialog-title" className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-slate-900">
                  Reject {selectedCandidateIds.length} Candidate{selectedCandidateIds.length > 1 ? "s" : ""}?
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  Please review the candidate list below before confirming rejection.
                </p>
              </div>
            </div>

            <div className="p-5 text-xs text-slate-600 leading-relaxed font-sans space-y-3 overflow-y-auto">
              {/* In Progress Warning Alert if any candidate is active */}
              {hasInProgressSelected && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900 text-xs">
                  <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">warning</span>
                  <div>
                    <span className="font-bold">Active Interview In Progress:</span> One or more selected candidates currently have an active interview session. Rejecting will cancel and terminate their evaluation.
                  </div>
                </div>
              )}

              <p>
                The following candidate(s) will have their status updated to <span className="font-semibold text-red-600">Rejected</span>:
              </p>

              {/* List of candidate names and roles */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                {selectedCandidatesList.map(cand => (
                  <div key={cand.id} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-100 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CandidateAvatar name={cand.name} avatarUrl={cand.avatarUrl} className="w-6 h-6 text-[10px]" />
                      <div className="truncate">
                        <span className="font-bold text-[var(--text)]">{cand.name}</span>
                        <span className="text-[11px] text-[var(--text-muted)] ml-1">({cand.role})</span>
                      </div>
                    </div>
                    <StatusBadge status={cand.status} />
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 font-medium">
                Note: You will be able to immediately undo this operation via the notification toast.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                disabled={isRejectingLoading}
                onClick={() => setIsRejectConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRejectingLoading}
                onClick={confirmBulkReject}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRejectingLoading && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{isRejectingLoading ? "Rejecting..." : "Confirm Rejection"}</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ─────────────────────────────────────────────────────────────
          INTERVIEW RECORDING VIEWER MODAL
      ───────────────────────────────────────────────────────────── */}
      {recordingModalCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[var(--border)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">videocam</span>
                </div>
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                    Interview Recording · {recordingModalCandidate.name}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {recordingModalCandidate.role} · {recordingModalCandidate.completedAt}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRecordingModalCandidate(null)}
                className="w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-alt)] flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Video Player (Supports real recordingUrl or mock video preview) */}
            <div className="p-6 flex flex-col gap-4">
              <div className="relative aspect-video bg-[var(--text)] rounded-xl overflow-hidden flex flex-col items-center justify-center text-white group shadow-inner">
                {recordingModalCandidate.recordingUrl ? (
                  <video
                    controls
                    autoPlay
                    src={recordingModalCandidate.recordingUrl}
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white cursor-pointer hover:scale-105 transition-transform shadow-lg">
                      <span className="material-symbols-outlined text-3xl">play_arrow</span>
                    </div>
                    {/* Controls Bar */}
                    <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-xs text-white">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">play_circle</span>
                        <span className="font-mono text-[11px]">04:15 / 18:30</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">volume_up</span>
                        <span className="material-symbols-outlined text-[18px]">fullscreen</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                  <span className="px-2 py-0.5 rounded bg-red-600/90 text-white text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    RECORDED HD
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                    1080p · 24fps
                  </span>
                </div>
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono pointer-events-none">
                  Score: {recordingModalCandidate.score}/100
                </div>
              </div>

              {/* Proctoring & AI Telemetry Snippet */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] font-semibold">Anti-Cheat Proctoring</span>
                  <span className="font-bold text-[var(--text)] flex items-center gap-1">
                    {recordingModalCandidate.tabSwitches && recordingModalCandidate.tabSwitches > 0 ? (
                      <>
                        <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
                        <span className="text-amber-700">{recordingModalCandidate.tabSwitches} window switches flagged</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-emerald-600 text-sm">verified_user</span>
                        <span className="text-emerald-700">Clean Session (0 tab switches)</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] font-semibold">AI Evaluation Verdict</span>
                  <span className="font-bold text-[var(--primary)] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    <span>{getAIVerdict(recordingModalCandidate)?.label || "Evaluated"}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  const cand = recordingModalCandidate;
                  setRecordingModalCandidate(null);
                  setSelectedCandidateForScorecard(cand);
                }}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">assignment</span>
                <span>View Full Evaluation Scorecard</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          APPROVE / REJECT DECISION MODAL
      ───────────────────────────────────────────────────────────── */}
      {decisionModalCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">gavel</span>
                </div>
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                    Candidate Review Decision
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Pending recruiter & hiring manager sign-off
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDecisionModalCandidate(null)}
                className="w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-alt)] flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] text-[var(--text)] flex items-center justify-center font-bold text-xs">
                  {decisionModalCandidate.initials || decisionModalCandidate.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-[var(--text)]">{decisionModalCandidate.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{decisionModalCandidate.role}</span>
                </div>
                <div className="ml-auto text-right">
                  <span className="text-xs font-mono font-bold text-[var(--primary)] bg-white px-2 py-0.5 rounded shadow-sm">
                    Score: {decisionModalCandidate.score}/100
                  </span>
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                The AI evaluation has verified technical capabilities and communication fundamentals. Would you like to approve this candidate for on-site rounds or reject their application?
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => handleApproveCandidate(decisionModalCandidate)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Approve for Next Round</span>
                </button>

                <button
                  onClick={() => handleRejectCandidate(decisionModalCandidate)}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                  <span>Reject Application</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: STITCH RESUME UPLOAD & ANALYSIS MODAL
          (Mirrors Screen 675157b2e05d4b0e9679b3f622b1d528)
      ───────────────────────────────────────────────────────────── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[var(--border)] flex flex-col my-auto">
            {/* Modal Header & Intake Funnel Stepper */}
            <div className="p-6 bg-white border-b border-[var(--border)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary)] text-white">
                    <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                  </span>
                  <div>
                    <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[var(--text)]">
                      Candidate Intake Funnel
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      Session #INT-{Date.now().toString().slice(-4)} · Resume Intelligence Pipeline
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-alt)] text-[var(--text-muted)] flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Stepper Bar */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary)] text-white font-semibold">
                  <span className="w-4 h-4 rounded-full bg-white text-[var(--primary)] flex items-center justify-center text-[10px]">1</span>
                  <span>Upload Resume</span>
                </div>
                <span className="h-0.5 w-6 bg-[var(--primary)] rounded-full" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary-soft)]/30 text-[var(--text)] font-medium">
                  <span className="w-4 h-4 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Analyze Candidate</span>
                </div>
                <span className="h-0.5 w-6 bg-[var(--primary-soft)]/30 rounded-full" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)]">
                  <span className="w-4 h-4 rounded-full bg-[var(--primary-soft)]/30 flex items-center justify-center text-[10px]">3</span>
                  <span>Live Video Interview</span>
                </div>
                <span className="h-0.5 w-6 bg-[var(--primary-soft)]/30 rounded-full" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)]">
                  <span className="w-4 h-4 rounded-full bg-[var(--primary-soft)]/30 flex items-center justify-center text-[10px]">4</span>
                  <span>Evaluation</span>
                </div>
              </div>
            </div>

            {/* Modal Body: Two-Column Experience Grid */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Drag & Drop Zone */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <div className="bg-white rounded-xl p-5 border border-[var(--border)] flex flex-col gap-3">
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                    Target Role & Job Description
                  </h3>
                  <input
                    type="text"
                    value={jobTitleInput}
                    onChange={(e) => setJobTitleInput(e.target.value)}
                    placeholder="Job Title (e.g. Machine Learning Engineer)"
                    className="h-9 px-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg text-xs outline-none focus:border-[var(--primary)]"
                  />
                  <textarea
                    rows={3}
                    value={jobDescriptionInput}
                    onChange={(e) => setJobDescriptionInput(e.target.value)}
                    placeholder="Job Description / Key Requirements..."
                    className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg text-xs outline-none focus:border-[var(--primary)] resize-none"
                  />
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Similarity Threshold:</span>
                    <span className="font-bold text-[var(--primary)] font-mono">{thresholdInput}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={90}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>

                {/* Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileDropOrChange(e.dataTransfer.files);
                  }}
                  className="rounded-xl p-6 bg-[var(--surface-alt)] border-2 border-dashed border-[var(--border)] hover:border-[var(--primary-soft)] transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--primary-soft)]/30 text-[var(--primary)] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">upload_file</span>
                  </div>
                  <p className="font-bold text-sm text-[var(--text)]">Drag and drop resume here</p>
                  <p className="text-xs text-[var(--text-muted)] mb-3">or browse from your device</p>
                  <span className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold">
                    Browse Files
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileDropOrChange(e.target.files)}
                  />
                  <div className="mt-3 text-[0.6875rem] text-[var(--text-muted)] flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-xs">info</span>
                    <span>PDF or DOCX format only • Max 5MB per file</span>
                  </div>
                </div>

                {/* Uploaded Files Listing with per-file progress & error states (Requirement 3) */}
                {uploadItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text)]">
                        Selected Files ({uploadItems.filter(i => i.status !== "error").length} valid / {uploadItems.length} total)
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">Max 5 MB each</span>
                    </div>
                    {uploadItems.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className={`p-2.5 rounded-lg border flex flex-col gap-1.5 text-xs transition-all ${
                          item.status === "error"
                            ? "bg-red-50/80 border-red-200"
                            : item.status === "uploading"
                            ? "bg-blue-50/60 border-blue-200"
                            : item.status === "success"
                            ? "bg-emerald-50/60 border-emerald-200"
                            : "bg-white border-[var(--border)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {item.extension === "pdf" ? (
                              <span className="material-symbols-outlined text-red-500 text-lg">picture_as_pdf</span>
                            ) : (
                              <span className="material-symbols-outlined text-blue-600 text-lg">description</span>
                            )}
                            <span className="font-medium text-[var(--text)] truncate max-w-[200px] sm:max-w-[240px]">
                              {item.name}
                            </span>
                            <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono">
                              {item.size === 0
                                ? "0 KB"
                                : item.size < 1024 * 1024
                                ? `${Math.max(1, Math.round(item.size / 1024))} KB`
                                : `${(item.size / (1024 * 1024)).toFixed(1)} MB`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.status === "error" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[12px]">error</span>
                                {item.errorMessage || "Validation failed"}
                              </span>
                            )}
                            {item.status === "uploading" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold animate-pulse">
                                Screening ({item.progress}%)
                              </span>
                            )}
                            {item.status === "success" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                Ready
                              </span>
                            )}
                            {item.status === "idle" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-semibold">
                                Ready to Screen
                              </span>
                            )}

                            <button
                              onClick={() => handleRemoveFile(idx)}
                              className="text-[var(--text-muted)] hover:text-red-600 p-0.5 transition-colors"
                              title="Remove file"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </div>
                        </div>

                        {/* Progress bar for uploading/processing file */}
                        {item.status === "uploading" && (
                          <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-[var(--primary)] h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* SOC2 Privacy Assurance Card */}
                <div className="p-3 rounded-xl bg-white border border-[var(--border)] flex items-center gap-3">
                  <span className="material-symbols-outlined text-[var(--primary)] text-xl shrink-0">encrypted</span>
                  <p className="text-[0.6875rem] text-[var(--text-muted)] leading-relaxed">
                    Resume parsing is strictly isolated to personalize the interview experience. Encrypted at rest & in transit.
                  </p>
                </div>
              </div>

              {/* Right Column: 6 Intelligence Vectors & Extraction Telemetry */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <div className="bg-white rounded-xl p-5 border border-[var(--border)] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                      What AI Interview Agent Understands
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--primary-soft)]/30 text-[var(--text)] text-[0.6875rem] font-bold">
                      Resume Intelligence
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    More than keywords. We identify the experience, skills, and knowledge areas behind the resume.
                  </p>

                  {/* 6 Intelligence Vectors */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[var(--primary)] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">badge</span>
                        <span>Candidate Profile</span>
                      </div>
                      <p className="text-[0.6875rem] text-[var(--text-muted)]">Name, contact, summary</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[var(--primary)] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">terminal</span>
                        <span>Technical Skills</span>
                      </div>
                      <p className="text-[0.6875rem] text-[var(--text-muted)]">Languages, frameworks, tools</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[var(--primary)] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">work_history</span>
                        <span>Work Experience</span>
                      </div>
                      <p className="text-[0.6875rem] text-[var(--text-muted)]">Roles, production scope</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[var(--primary)] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">school</span>
                        <span>Education</span>
                      </div>
                      <p className="text-[0.6875rem] text-[var(--text-muted)]">Degrees, institutions</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[var(--primary)] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">account_tree</span>
                        <span>Projects</span>
                      </div>
                      <p className="text-[0.6875rem] text-[var(--text-muted)]">Architecture, toolsets</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[var(--primary)] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">radar</span>
                        <span>Interview Probes</span>
                      </div>
                      <p className="text-[0.6875rem] text-[var(--text-muted)]">Focus areas, edge gaps</p>
                    </div>
                  </div>

                  {/* Knowledge Profile Calibrated badge */}
                  <div className="p-3 rounded-lg bg-[var(--surface-alt)] flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[var(--primary)]">hub</span>
                      <div className="text-xs">
                        <p className="font-semibold text-[var(--text)]">Candidate Knowledge Profile</p>
                        <p className="text-[0.6875rem] text-[var(--text-muted)]">Calibrated with role benchmarks</p>
                      </div>
                    </div>
                    <span className="text-[0.6875rem] text-[var(--primary)] font-bold font-mono">CALIBRATED</span>
                  </div>

                  {/* Extraction Telemetry Bar */}
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[0.6875rem] font-mono text-[var(--text-muted)]">
                      <span>Extraction Telemetry</span>
                      <span>Confidence: 99.4%</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--surface-alt)] rounded-full overflow-hidden flex">
                      <div className="h-full bg-[var(--primary)] w-[45%]" title="Skills" />
                      <div className="h-full bg-[var(--primary)] w-[30%]" title="Experience" />
                      <div className="h-full bg-[var(--primary-soft)] w-[15%]" title="Projects" />
                      <div className="h-full bg-[var(--text-muted)] w-[10%]" title="Academia" />
                    </div>
                    <div className="flex items-center gap-3 text-[0.6875rem] font-mono text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />Skills 45%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />Experience 30%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary-soft)]" />Projects 15%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />Academia 10%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recruiter Tip Callout */}
                <div className="p-4 rounded-xl bg-white border border-[var(--border)] flex items-start gap-3">
                  <span className="material-symbols-outlined text-[var(--primary)] text-xl mt-0.5">tips_and_updates</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text)]">Adaptive Generation Ready</span>
                    <p className="text-[0.6875rem] text-[var(--text-muted)] leading-relaxed mt-0.5">
                      The AI interviewer will frame scenario-based questions directly around the candidate's actual projects and core skills.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-white border-t border-[var(--border)] flex items-center justify-between">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 text-xs text-[var(--text-muted)] hover:underline font-semibold"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                <button
                  disabled={isAnalyzing}
                  onClick={() => {
                    // Quick Demo Candidate insertion
                    const sample: CandidateRecord = {
                      id: `cand-sample-${Date.now()}`,
                      name: "Alex Johnson",
                      email: "alex.johnson@example.com",
                      role: jobTitleInput || "Senior Software Engineer",
                      type: "AI Async",
                      status: "Screened",
                      score: 88,
                      completedAt: "Just now",
                      skills: ["Python", "FastAPI", "React", "Docker", "MongoDB"],
                      avatarBg: "bg-[var(--primary-soft)]/25 text-[var(--text)]",
                      initials: "AJ",
                      resumeText: "Alex Johnson. Senior Software Engineer with 5+ years experience in Python, FastAPI, React, Docker, and MongoDB."
                    };
                    setCandidates(prev => [sample, ...prev]);
                    toast({
                      title: "Sample Candidate Screened",
                      description: "Added Alex Johnson with 88% match score."
                    });
                    setIsUploadModalOpen(false);
                  }}
                  className="px-4 py-2 bg-[var(--surface-alt)] hover:bg-[var(--surface-alt)] text-[var(--text)] rounded-lg text-xs font-semibold transition-colors"
                >
                  Load Sample Candidate
                </button>

                <button
                  disabled={isAnalyzing || uploadItems.filter(i => i.status !== "error").length === 0}
                  onClick={handleRunResumeAnalysis}
                  className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      <span>Analyzing Resumes...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      <span>Run AI Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6B: SCHEDULE NEW INTERVIEW MODAL (Requirement 1)
          Creates unique single-use interview link (/interview/[token])
          that expires in 48 hours, ready to copy or email
      ───────────────────────────────────────────────────────────── */}
      {isNewInterviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] rounded-2xl max-w-xl w-full shadow-2xl border border-[var(--border)] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-white border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                </div>
                <div>
                  <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[var(--text)]">
                    Schedule New Interview
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Create a unique single-use candidate link (valid for 48 hours)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsNewInterviewModalOpen(false);
                  setGeneratedInterviewLink(null);
                  setGeneratedToken(null);
                }}
                className="w-8 h-8 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-alt)] text-[var(--text-muted)] flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              {!generatedInterviewLink ? (
                <>
                  {/* Candidate Selection Mode Tabs */}
                  <div className="flex rounded-lg bg-[var(--surface-alt)]/60 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setCandidateSelectMode("existing")}
                      className={`flex-1 py-1.5 rounded-md transition-all ${
                        candidateSelectMode === "existing"
                          ? "bg-white text-[var(--primary)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      Existing Pipeline Candidate
                    </button>
                    <button
                      type="button"
                      onClick={() => setCandidateSelectMode("new")}
                      className={`flex-1 py-1.5 rounded-md transition-all ${
                        candidateSelectMode === "new"
                          ? "bg-white text-[var(--primary)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      + New Candidate
                    </button>
                  </div>

                  {candidateSelectMode === "existing" ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[var(--text)]">
                        Select Candidate
                      </label>
                      <select
                        value={newInterviewCandidateId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setNewInterviewCandidateId(id);
                          const cand = candidates.find(c => c.id === id);
                          if (cand) {
                            setNewInterviewRole(cand.role || newInterviewRole);
                          }
                        }}
                        className="h-10 px-3 bg-white border border-[var(--border)] rounded-lg text-xs text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                      >
                        <option value="">-- Choose Candidate from Pipeline --</option>
                        {candidates.map((cand) => (
                          <option key={cand.id} value={cand.id}>
                            {cand.name} ({cand.email}) — {cand.role}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[var(--text)]">
                          Candidate Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Maya Chen"
                          value={newInterviewCandidateName}
                          onChange={(e) => setNewInterviewCandidateName(e.target.value)}
                          className="h-10 px-3 bg-white border border-[var(--border)] rounded-lg text-xs text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[var(--text)]">
                          Candidate Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="e.g. maya.chen@example.com"
                          value={newInterviewCandidateEmail}
                          onChange={(e) => setNewInterviewCandidateEmail(e.target.value)}
                          className="h-10 px-3 bg-white border border-[var(--border)] rounded-lg text-xs text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Role Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--text)]">
                      Job Role / Target Position
                    </label>
                    <select
                      value={newInterviewRole}
                      onChange={(e) => setNewInterviewRole(e.target.value)}
                      className="h-10 px-3 bg-white border border-[var(--border)] rounded-lg text-xs text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                    >
                      <option value="Machine Learning Engineer">Machine Learning Engineer</option>
                      <option value="Frontend Developer">Frontend Developer</option>
                      <option value="Backend Engineer">Backend Engineer</option>
                      <option value="Data Analyst">Data Analyst</option>
                      <option value="Full Stack Developer">Full Stack Developer</option>
                      <option value="DevOps & Cloud Engineer">DevOps & Cloud Engineer</option>
                      <option value="AI / NLP Research Engineer">AI / NLP Research Engineer</option>
                      <option value="Product Security Specialist">Product Security Specialist</option>
                    </select>
                  </div>

                  {/* Optional Job Description */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--text)] flex items-center justify-between">
                      <span>Job Description / Key Focus (Optional)</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-normal">Passed to AI Interviewer</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Seeking senior engineer experienced in distributed systems, clean architecture, and API design."
                      value={newInterviewJobDescription}
                      onChange={(e) => setNewInterviewJobDescription(e.target.value)}
                      className="p-2.5 bg-white border border-[var(--border)] rounded-lg text-xs text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] resize-none"
                    />
                  </div>

                  {/* Optional Skills Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--text)]">
                      Required Skills (Optional, comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. React, TypeScript, Python, Microservices"
                      value={newInterviewSkills}
                      onChange={(e) => setNewInterviewSkills(e.target.value)}
                      className="h-10 px-3 bg-white border border-[var(--border)] rounded-lg text-xs text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>

                  {/* Optional Resume Upload */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--text)] flex items-center justify-between">
                      <span>Candidate Resume (Optional, PDF / DOCX / TXT)</span>
                      {newInterviewResumeFile && (
                        <span className="text-[10px] text-emerald-700 font-semibold">{newInterviewResumeFile.name}</span>
                      )}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewInterviewResumeFile(file);
                          if (file.type === "text/plain") {
                            const reader = new FileReader();
                            reader.onload = () => setNewInterviewResumeText(reader.result as string);
                            reader.readAsText(file);
                          }
                        }
                      }}
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary)]/10 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/20 cursor-pointer"
                    />
                  </div>

                  {/* Link Expiry Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--text)]">
                      Link Expiry Window
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { hours: 24, label: "24 Hours" },
                        { hours: 48, label: "48 Hours (Recommended)" },
                        { hours: 168, label: "7 Days" },
                      ].map((exp) => (
                        <button
                          key={exp.hours}
                          type="button"
                          onClick={() => setNewInterviewExpiryHours(exp.hours)}
                          className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all ${
                            newInterviewExpiryHours === exp.hours
                              ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs"
                              : "bg-white text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--surface-alt)]"
                          }`}
                        >
                          {exp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Security & Expiration Assurance Card */}
                  <div className="p-3.5 rounded-xl bg-sky-50/80 border border-sky-100 flex items-start gap-3 text-xs text-sky-900">
                    <span className="material-symbols-outlined text-sky-700 text-lg mt-0.5">timer</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold">Cryptographically Secured Single-Use Link</span>
                      <p className="text-[11px] text-sky-800 leading-relaxed">
                        Only the SHA-256 hash is saved to the database. Once the candidate submits, the link is permanently locked.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                /* Link Generated View (Requirement 2: Recruiter stays on dashboard) */
                <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-600 text-xl mt-0.5">check_circle</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-emerald-900">Interview Link Successfully Generated</span>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Single-use link ready for candidate. Valid for {newInterviewExpiryHours} hours until{" "}
                        <strong className="font-mono">{new Date(Date.now() + newInterviewExpiryHours*3600*1000).toLocaleString()}</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Formatted Link Box */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--text)] flex items-center justify-between">
                      <span>Unique Candidate URL</span>
                      <span className="text-[10px] text-emerald-700 font-semibold font-mono bg-emerald-100 px-2 py-0.5 rounded">
                        Expires in {newInterviewExpiryHours}h
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedInterviewLink}
                        className="flex-1 h-10 px-3 bg-white border border-[var(--border)] rounded-lg text-xs font-mono text-[var(--text)] select-all outline-none"
                      />
                      <button
                        onClick={handleCopyInterviewLink}
                        className={`h-10 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                          isLinkCopied
                            ? "bg-emerald-600 text-white"
                            : "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isLinkCopied ? "done" : "content_copy"}
                        </span>
                        <span>{isLinkCopied ? "Copied!" : "Copy Link"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Sharing & Dispatch Actions (Recruiter stays on dashboard) */}
                  <div className="flex flex-col gap-2.5 pt-1">
                    {/* Fallback Action: Ready-to-paste message for WhatsApp/Slack */}
                    <button
                      type="button"
                      onClick={handleCopyInvitationMessage}
                      className={`h-10 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all shadow-sm ${
                        isMessageCopied
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-white border-[var(--border)] hover:bg-[var(--surface-alt)] text-[var(--text)]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">
                        {isMessageCopied ? "done_all" : "chat"}
                      </span>
                      <span>
                        {isMessageCopied ? "Invitation Message Copied!" : "Copy Full Invitation Message (WhatsApp / Slack)"}
                      </span>
                    </button>

                    {/* Email Dispatch State Machine */}
                    {emailSendingState === "idle" && (
                      <button
                        type="button"
                        onClick={handleSendEmailInvite}
                        className="h-10 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-white border border-[var(--border)] hover:bg-[var(--surface-alt)] text-[var(--text)] transition-all shadow-sm cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">mail</span>
                        <span>Send Email Invitation to Candidate</span>
                      </button>
                    )}

                    {emailSendingState === "sending" && (
                      <button
                        type="button"
                        disabled
                        className="h-10 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed shadow-xs"
                      >
                        <span className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                        <span>Sending invitation email...</span>
                      </button>
                    )}

                    {emailSendingState === "sent" && (
                      <div className="h-10 px-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs">
                        <span className="material-symbols-outlined text-[18px] text-emerald-600">mark_email_read</span>
                        <span>Email Sent Successfully ✓</span>
                      </div>
                    )}

                    {emailSendingState === "failed" && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex flex-col gap-2 shadow-xs">
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0 mt-0.5">error</span>
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-bold text-red-800">Email Delivery Failed</span>
                            <span className="text-[11px] text-red-600 font-mono mt-0.5 break-words">
                              {emailErrorMessage || "Failed to deliver email"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendEmailInvite}
                          className="self-end h-7 px-3 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">refresh</span>
                          <span>Retry Email</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-[var(--border)] flex items-center justify-between">
              {generatedInterviewLink ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsNewInterviewModalOpen(false);
                    setGeneratedInterviewLink(null);
                    setGeneratedToken(null);
                    setGeneratedCandidateId(null);
                    setEmailSendingState("idle");
                    setEmailErrorMessage(null);
                  }}
                  className="ml-auto h-9 px-6 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">done</span>
                  <span>Done</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewInterviewModalOpen(false);
                      setGeneratedInterviewLink(null);
                      setGeneratedToken(null);
                      setGeneratedCandidateId(null);
                    }}
                    className="px-4 py-2 text-xs text-[var(--text-muted)] hover:underline font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={isCreatingLink}
                    onClick={handleCreateInterviewLink}
                    className="h-9 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                  >
                    {isCreatingLink ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generating Secure Link...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">link</span>
                        <span>Create Single-Use Link</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: STITCH SCORECARD & CANDIDATE DETAILS MODAL
          (Mirrors Screen 35de875130c04250bc63561926decbc7)
      ───────────────────────────────────────────────────────────── */}
      {selectedCandidateForScorecard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--bg)] rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[var(--border)] flex flex-col my-auto">
            {/* Scorecard Header */}
            <div className="p-5 bg-white border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-xs">
                  IA
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[var(--text)]">
                      Interview Result & Performance Scorecard
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary-soft)]/25 text-[var(--text)] text-[0.6875rem] font-bold font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                      EVALUATION COMPLETE
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Candidate: {selectedCandidateForScorecard.name} · Role: {selectedCandidateForScorecard.role}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCandidateForScorecard(null)}
                className="w-8 h-8 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-alt)] text-[var(--text-muted)] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Scorecard Content */}
            <div className="p-6 flex flex-col gap-6">
              {/* Overall Performance Card (Hero Centerpiece) */}
              <div className="p-6 bg-white rounded-2xl border border-[var(--border)] shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Circular Gauge */}
                <div className="md:col-span-6 flex items-center gap-5">
                  <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[var(--surface-alt)]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                      />
                      <path
                        className="text-[var(--primary)]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${selectedCandidateForScorecard.score || 82}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.4"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-black text-[var(--primary)] leading-none">
                        {selectedCandidateForScorecard.score || 82}
                      </span>
                      <span className="text-[0.6875rem] font-mono text-[var(--text-muted)]">/ 100</span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--primary-soft)]/25 text-[var(--text)] text-xs font-bold w-max mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                      Strong Performance
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">Percentile: Top 14%</span>
                    <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[var(--text)] mt-0.5">
                      {selectedCandidateForScorecard.name}
                    </h3>
                    <p className="text-xs text-[var(--primary)] font-medium">
                      {selectedCandidateForScorecard.role} Assessment
                    </p>
                  </div>
                </div>

                {/* Stat Pills */}
                <div className="md:col-span-6 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex flex-col">
                    <span className="text-[0.6875rem] font-mono font-bold uppercase text-[var(--text-muted)]">Video Stream</span>
                    <span className="text-sm font-bold text-[var(--text)]">24 min HD</span>
                    <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono">100% verified</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex flex-col">
                    <span className="text-[0.6875rem] font-mono font-bold uppercase text-[var(--text-muted)]">Responses</span>
                    <span className="text-sm font-bold text-[var(--text)]">8 Evaluated</span>
                    <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono">All questions answered</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex flex-col">
                    <span className="text-[0.6875rem] font-mono font-bold uppercase text-[var(--text-muted)]">Real-Time Probes</span>
                    <span className="text-sm font-bold text-[var(--text-muted)]">5 Dynamic</span>
                    <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono">AI follow-ups</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex flex-col">
                    <span className="text-[0.6875rem] font-mono font-bold uppercase text-[var(--text-muted)]">Focus Areas</span>
                    <span className="text-sm font-bold text-[var(--primary)]">6 Explored</span>
                    <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono">Full rubric depth</span>
                  </div>
                </div>
              </div>

              {/* Core Competencies Breakdown */}
              <div className="bg-white rounded-2xl p-6 border border-[var(--border)] shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-[var(--primary)] font-mono">
                      Dimensions
                    </span>
                    <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                      Core Competencies
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-muted)]">Benchmark: 75%</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Metric 1 */}
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Technical Depth</span>
                      <span className="text-[var(--primary)] font-mono">84%</span>
                    </div>
                    <div className="w-full bg-[var(--surface-alt)] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[var(--primary)] h-full rounded-full" style={{ width: "84%" }} />
                    </div>
                    <p className="text-[0.6875rem] text-[var(--text-muted)]">Good understanding of core concepts.</p>
                  </div>

                  {/* Metric 2 */}
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Problem Solving</span>
                      <span className="text-[var(--primary)] font-mono">79%</span>
                    </div>
                    <div className="w-full bg-[var(--surface-alt)] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[var(--primary)] h-full rounded-full" style={{ width: "79%" }} />
                    </div>
                    <p className="text-[0.6875rem] text-[var(--text-muted)]">Approached challenges logically.</p>
                  </div>

                  {/* Metric 3 */}
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Verbal Articulation</span>
                      <span className="text-[var(--primary)] font-mono">88%</span>
                    </div>
                    <div className="w-full bg-[var(--surface-alt)] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[var(--primary)] h-full rounded-full" style={{ width: "88%" }} />
                    </div>
                    <p className="text-[0.6875rem] text-[var(--text-muted)]">Coherent delivery and audio clarity.</p>
                  </div>

                  {/* Metric 4 */}
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Practical Experience</span>
                      <span className="text-[var(--text-muted)] font-mono">81%</span>
                    </div>
                    <div className="w-full bg-[var(--surface-alt)] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[var(--text-muted)] h-full rounded-full" style={{ width: "81%" }} />
                    </div>
                    <p className="text-[0.6875rem] text-[var(--text-muted)]">Real-world codebase exposure.</p>
                  </div>
                </div>
              </div>

              {/* Strengths & Growth Areas Two-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-5 rounded-2xl bg-white border border-[var(--border)] shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">verified</span>
                    <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                      Validated Strengths
                    </h4>
                  </div>
                  <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[var(--primary)] text-base shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>High vocal pacing and structured verbal delivery on camera.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[var(--primary)] text-base shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>Maintained precision when the AI interviewer asked follow-up probes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[var(--primary)] text-base shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>Demonstrated clear architectural trade-offs in scalable environments.</span>
                    </li>
                  </ul>
                </div>

                {/* Areas to Strengthen */}
                <div className="p-5 rounded-2xl bg-white border border-[var(--border)] shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">lightbulb</span>
                    <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[var(--text)]">
                      Areas to Strengthen
                    </h4>
                  </div>
                  <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[var(--primary)] text-base shrink-0 mt-0.5">
                        adjust
                      </span>
                      <span>Deepen understanding of edge caching strategies and memory boundaries.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[var(--primary)] text-base shrink-0 mt-0.5">
                        adjust
                      </span>
                      <span>Practice explaining how systems handle graceful degradation during traffic spikes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[var(--primary)] text-base shrink-0 mt-0.5">
                        adjust
                      </span>
                      <span>Strengthen task-aligned evaluation metrics selection.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Scorecard Footer Actions */}
            <div className="p-5 bg-white border-t border-[var(--border)] flex items-center justify-between">
              <button
                onClick={() => setSelectedCandidateForScorecard(null)}
                className="px-4 py-2 text-xs text-[var(--text-muted)] hover:underline font-semibold"
              >
                Close
              </button>

              {selectedCandidateForScorecard?.status === "Scheduled" && (
                <button
                  type="button"
                  onClick={() => {
                    const candidate = selectedCandidateForScorecard;
                    if (candidate) handleCopyCandidateLink(candidate);
                  }}
                  className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  <span>Copy Candidate Link</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterDashboard;
