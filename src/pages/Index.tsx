import React, { useEffect, useState, useRef } from 'react';
import { 
  Brain, 
  Video, 
  CheckCircle2, 
  BarChart3, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  Menu, 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  Github, 
  Linkedin, 
  Twitter, 
  Moon, 
  Sun, 
  Play, 
  Sparkles, 
  MessageSquare, 
  FileText,
  UserCheck, 
  Activity, 
  AlertTriangle,
  Zap,
  TrendingUp,
  Award,
  ChevronDown,
  LogOut,
  User
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useTheme } from '../context/ThemeContext';
import Chatbot from '../components/ui/chatbot';
import { verifyServerSession, logoutUserSession, AuthUser } from '../services/authService';

const Index = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [scrollY, setScrollY] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isRequestDemoOpen, setIsRequestDemoOpen] = useState(false);
  const [demoFormSubmitted, setDemoFormSubmitted] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Server-verified user & session state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        const user = await verifyServerSession();
        if (isMounted) {
          setCurrentUser(user);
        }
      } catch {
        if (isMounted) setCurrentUser(null);
      }
    };
    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close user dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await logoutUserSession();
    setCurrentUser(null);
    navigate('/');
  };

  const homeRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  // Scroll animations with useInView
  const isHeroInView = useInView(homeRef, { once: true, margin: "-80px" });
  const isHowItWorksInView = useInView(howItWorksRef, { once: true, margin: "-80px" });
  const isFeaturesInView = useInView(featuresRef, { once: true, margin: "-80px" });
  const isStatsInView = useInView(statsRef, { once: true, margin: "-80px" });
  const isAboutInView = useInView(aboutRef, { once: true, margin: "-80px" });
  const isContactInView = useInView(contactRef, { once: true, margin: "-80px" });

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);

      const sections = [
        { ref: homeRef, id: 'home' },
        { ref: howItWorksRef, id: 'how-it-works' },
        { ref: featuresRef, id: 'features' },
        { ref: aboutRef, id: 'about' },
        { ref: contactRef, id: 'contact' }
      ];

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.ref.current) {
          const { top } = section.ref.current.getBoundingClientRect();
          if (top <= 120) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    setIsMenuOpen(false);
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGetStarted = () => {
    if (currentUser) {
      if (currentUser.role === 'CANDIDATE') {
        navigate('/interview');
      } else {
        navigate('/dashboard');
      }
    } else {
      navigate('/login');
    }
  };

  const howItWorksSteps = [
    {
      number: "01",
      title: "Recruiter Invites Candidate",
      badge: "48h Single-Use Token",
      description: "Pick a job role, customize technical criteria, and generate a single-use interview invite link valid for 48 hours to email or copy directly.",
      icon: <UserCheck className="w-6 h-6 text-[var(--primary)]" />
    },
    {
      number: "02",
      title: "AI Conducts Video Interview",
      badge: "Voice & Video AI",
      description: "Our autonomous AI interviewer questions the candidate over live video & voice, probing depth with 10 adaptive questions and proctoring telemetry.",
      icon: <Video className="w-6 h-6 text-[var(--primary)]" />
    },
    {
      number: "03",
      title: "Recruiter Reviews Scores & Report",
      badge: "Instant Scorecards",
      description: "Instantly review technical correctness scores (0-100), communication breakdown, integrity signals, and synchronized video recordings in your dashboard.",
      icon: <Award className="w-6 h-6 text-[var(--primary)]" />
    }
  ];

  const features = [
    {
      icon: <Video className="w-6 h-6" />,
      title: 'AI Video & Voice Interviews',
      description: 'Conversational AI interviewer conducts natural, spoken dialogue over live video with turn-by-turn speech recognition and synthesis.'
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: 'Adaptive Follow-Up Questions',
      description: 'The LLM dynamically challenges candidate answers with follow-ups, verifying real problem-solving ability beyond rehearsed lines.'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Objective Scorecards & Reports',
      description: 'Rigorous multi-dimensional grading across technical correctness, systems thinking, and communication with actionable hiring verdicts.'
    },
    {
      icon: <Play className="w-6 h-6" />,
      title: 'Full Recording & Bookmarks',
      description: 'Synchronized session video replay with turn-by-turn question timestamps, allowing recruiters to review critical answers in seconds.'
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: 'Proctoring & Flagging Telemetry',
      description: 'Automated monitoring for tab switching, window focus loss, and integrity signals ensures every candidate assessment is genuine.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Pipeline Conversion Analytics',
      description: 'Track candidate flow from application to interview completion, average score distributions, and export structured talent CSVs.'
    }
  ];

  const stats = [
    { value: "75%", label: "Faster Time-to-Hire", helper: "From weeks to under 48 hours" },
    { value: "10/10", label: "Technical Questions", helper: "Adaptive & depth-verified" },
    { value: "48h", label: "Single-Use Expiration", helper: "Secured candidate invites" },
    { value: "100%", label: "Standardized Scoring", helper: "Zero unconscious interviewer bias" }
  ];

  const aiChatMessages = [
    "Hello! Welcome to AI Interview Agent. Are you looking to streamline your engineering technical interviews? 👋",
    "Yes! How does the autonomous video interview work?",
    "Candidates receive a 48-hour secure link. Our conversational AI interviewer asks 10 adaptive technical questions over live video & voice, probing depth and system tradeoffs. 🎯",
    "What do recruiters see afterwards?",
    "You get an instant multi-dimensional scorecard, technical correctness ratings, integrity flags, and video replay bookmarks right in your dashboard! 🚀",
    "Can I schedule a live demo?",
    "Absolutely! Click 'Request a Demo' at the top, or click 'Get Started' to test the interview room immediately!"
  ];

  return (
    <div className="min-h-screen font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[var(--primary-soft)]/30 selection:text-[var(--text)] transition-colors duration-200 bg-[var(--bg)] text-[var(--text)]">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVBAR (Requirement 3)
      ───────────────────────────────────────────────────────────── */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrollY > 20 
            ? 'bg-[var(--surface)]/85 backdrop-blur-md border-b border-[var(--border)] shadow-soft-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none">
            <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-[var(--text)]">
                AI Interview <span className="text-[var(--primary)]">Agent</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] font-mono">
                Autonomous Video Screening
              </span>
            </div>
          </Link>
          
          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {[
              { name: 'Home', ref: homeRef, id: 'home' },
              { name: 'How It Works', ref: howItWorksRef, id: 'how-it-works' },
              { name: 'Features', ref: featuresRef, id: 'features' },
              { name: 'About', ref: aboutRef, id: 'about' },
              { name: 'Contact', ref: contactRef, id: 'contact' }
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => scrollToSection(item.ref)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeSection === item.id 
                    ? 'text-[var(--primary)] bg-[var(--surface-alt)] font-semibold shadow-xs' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-alt)]/50'
                }`}
              >
                {item.name}
              </button>
            ))}
          </nav>

          {/* Action CTAs & Theme Toggle */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors shadow-soft-sm"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Requirement 1 & 2: Server-verified Auth State & User Menu */}
            {currentUser ? (
              <div className="flex items-center space-x-2">
                {/* CANDIDATE: Show only 'My Interview', NEVER a dashboard link */}
                {currentUser.role === 'CANDIDATE' ? (
                  <button 
                    onClick={() => navigate('/interview')}
                    className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-semibold shadow-soft transition-all flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <Video size={14} />
                    <span>My Interview</span>
                  </button>
                ) : (
                  /* RECRUITER / ADMIN: Show 'Go to Dashboard' */
                  <button 
                    onClick={() => navigate('/dashboard')}
                    className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-semibold shadow-soft transition-all flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <span>Go to Dashboard</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                {/* User Profile Menu with Sign Out */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="h-9 px-2.5 py-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 hover:border-[var(--primary-soft)] transition-colors shadow-soft-sm text-[var(--text)]"
                    aria-label="User Account Menu"
                  >
                    <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white font-bold text-[10px] flex items-center justify-center">
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : (currentUser.role === 'CANDIDATE' ? 'C' : 'R')}
                    </div>
                    <span className="text-xs font-semibold text-[var(--text)] max-w-[110px] truncate">
                      {currentUser.name || currentUser.email.split('@')[0]}
                    </span>
                    <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-52 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-soft-lg py-1.5 z-50 text-xs"
                      >
                        <div className="px-3.5 py-2.5 border-b border-[var(--border)]">
                          <p className="font-semibold text-[var(--text)] truncate">
                            {currentUser.name || 'User'}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{currentUser.email}</p>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[var(--surface-alt)] text-[var(--primary)] font-mono">
                            {currentUser.role}
                          </span>
                        </div>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-3.5 py-2 text-[var(--danger)] hover:bg-[var(--danger)]/10 flex items-center gap-2 font-medium transition-colors"
                        >
                          <LogOut size={13} />
                          <span>Sign Out</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => navigate('/login')}
                  className="h-9 px-4 border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-alt)] rounded-xl text-xs font-semibold transition-all shadow-soft-sm active:scale-[0.98]"
                >
                  Login
                </button>
                <button 
                  onClick={handleGetStarted}
                  className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-semibold shadow-soft transition-all flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <Sparkles size={14} />
                  <span>Get Started</span>
                </button>
              </>
            )}
          </div>
          
          {/* Mobile Menu & Theme Toggle */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl px-4 py-4 space-y-3"
            >
              {[
                { name: 'Home', ref: homeRef },
                { name: 'How It Works', ref: howItWorksRef },
                { name: 'Features', ref: featuresRef },
                { name: 'About', ref: aboutRef },
                { name: 'Contact', ref: contactRef }
              ].map((item) => (
                <button 
                  key={item.name}
                  onClick={() => scrollToSection(item.ref)}
                  className="block w-full text-left py-2 text-sm font-semibold text-[var(--text)]"
                >
                  {item.name}
                </button>
              ))}

              <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
                {currentUser ? (
                  <>
                    <div className="px-3 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[var(--text)] truncate">
                          {currentUser.name || currentUser.email}
                        </span>
                        <span className="text-[10px] text-[var(--primary)] font-semibold uppercase font-mono">
                          {currentUser.role}
                        </span>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="text-xs text-[var(--danger)] hover:underline flex items-center gap-1 font-semibold"
                      >
                        <LogOut size={12} />
                        <span>Sign Out</span>
                      </button>
                    </div>

                    {currentUser.role === 'CANDIDATE' ? (
                      <button 
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigate('/interview');
                        }}
                        className="w-full py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-soft"
                      >
                        <Video size={14} />
                        <span>My Interview</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigate('/dashboard');
                        }}
                        className="w-full py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-soft"
                      >
                        <span>Go to Dashboard</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate('/login');
                      }}
                      className="w-full py-2.5 border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] rounded-xl text-xs font-semibold"
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleGetStarted();
                      }}
                      className="w-full py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-semibold shadow-soft"
                    >
                      Get Started
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* ─────────────────────────────────────────────────────────────
            2. HERO SECTION (Lavender-white background + subtle peach glow)
        ───────────────────────────────────────────────────────────── */}
        <section ref={homeRef} className="pt-32 sm:pt-40 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden relative">
          {/* Subtle lavender-blue to peach ambient glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-[var(--primary-soft)]/20 via-[var(--surface-alt)]/30 to-[var(--accent)]/20 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Hero Column */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6 flex flex-col gap-6"
            >
              {/* Top Badge with peach accent */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent)]/30 text-[var(--accent-strong)] dark:text-[var(--accent)] text-xs font-bold font-mono border border-[var(--accent)]/50 w-fit shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-strong)] dark:bg-[var(--accent)] animate-pulse" />
                <span>Autonomous AI Video Interview Agent</span>
              </div>

              {/* Headline with one peach highlight word */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text)] leading-[1.12]">
                Hire faster with{" "}
                <span className="text-[var(--primary)]">
                  <span className="whitespace-nowrap">AI&#8209;led</span>
                </span>{" "}
                <span className="text-[var(--accent-strong)] dark:text-[var(--accent)]">video</span>{" "}
                <span className="text-[var(--text)]">interviews</span>
              </h1>

              {/* Subtext */}
              <p className="text-base sm:text-lg text-[var(--text-muted)] leading-relaxed max-w-xl">
                Let AI interview every candidate over video, then review scores, reports, and recordings in one centralized dashboard.
              </p>

              {/* Action Buttons: Solid primary + Outlined secondary */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <button 
                  onClick={handleGetStarted}
                  className="h-11 px-6 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-sm font-semibold shadow-soft flex items-center gap-2 transition-all active:scale-[0.98]"
                >
                  <span>Get Started Free</span>
                  <ArrowRight size={16} />
                </button>
                <button 
                  onClick={() => setIsDemoModalOpen(true)}
                  className="h-11 px-5 border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-alt)] text-[var(--text)] rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-soft-sm active:scale-[0.98]"
                >
                  <Play size={16} className="text-[var(--primary)] fill-[var(--primary-soft)]/20" />
                  <span>Watch Demo</span>
                </button>
              </div>

              {/* Trust Badges */}
              <div className="pt-4 flex items-center gap-6 text-xs text-[var(--text-muted)] font-medium flex-wrap">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-[var(--success)]" />
                  <span>Single-use 48h links</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-[var(--success)]" />
                  <span>Anti-cheating proctoring</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-[var(--success)]" />
                  <span>Objective 0–100 grading</span>
                </div>
              </div>
            </motion.div>

            {/* Right Hero Column: Product Preview Card with peach glow */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={isHeroInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="lg:col-span-6 relative"
            >
              {/* Subtle peach glow behind product preview card */}
              <div className="absolute -inset-3 bg-gradient-to-tr from-[var(--primary-soft)]/20 via-[var(--accent)]/35 to-[var(--surface-alt)]/40 rounded-3xl blur-2xl pointer-events-none -z-10" />

              <div className="relative rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-soft-lg overflow-hidden">
                {/* Mock Browser Header */}
                <div className="px-4 py-3 bg-[var(--surface-alt)]/60 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                    <span className="text-[11px] font-mono font-semibold text-[var(--text-muted)] ml-2">
                      ai-interview-agent.app/interview/session-live
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--danger)]/15 text-[var(--danger)] text-[10px] font-bold border border-[var(--danger)]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                    Live Interviewing · Q4/10
                  </span>
                </div>

                {/* Simulated Interview Stage */}
                <div className="p-5 flex flex-col gap-4">
                  {/* Video Grid Simulation */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Candidate Preview Tile */}
                    <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-slate-800 flex flex-col justify-between p-3">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="flex items-center justify-between relative z-10">
                        <span className="text-[10px] font-semibold text-white/90 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
                          Alex M. (Candidate)
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                          <Activity size={12} className="animate-pulse" /> Audio ON
                        </span>
                      </div>
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                          <ShieldCheck size={12} /> Proctoring: Clean (0 Tab Switches)
                        </span>
                      </div>
                    </div>

                    {/* AI Interviewer Tile */}
                    <div className="relative aspect-video rounded-xl bg-gradient-to-br from-[var(--surface-alt)] to-[var(--bg)] overflow-hidden border border-[var(--border)] flex flex-col justify-between p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-[var(--text)] bg-[var(--surface)]/80 px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1 border border-[var(--border)]">
                          <Brain size={12} className="text-[var(--primary)]" /> AI Interview Agent
                        </span>
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
                      </div>
                      <div className="flex flex-col items-center justify-center my-auto">
                        <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-soft">
                          <Sparkles size={18} className="animate-spin" style={{ animationDuration: '6s' }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-[var(--primary)] text-center font-medium">
                        Analyzing technical response...
                      </span>
                    </div>
                  </div>

                  {/* Active Question Bar */}
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)]/60 border border-[var(--border)] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[var(--primary)] font-mono uppercase tracking-wider">
                        AI INTERVIEWER QUESTION #4
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-medium">Adaptive Follow-Up</span>
                    </div>
                    <p className="text-xs font-semibold text-[var(--text)]">
                      "Could you explain how you design distributed cache eviction and prevent cache stampedes in a high-throughput microservices architecture?"
                    </p>
                  </div>

                  {/* Real-time AI Evaluation Strip */}
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                        Technical Accuracy: 8.5/10 · Direct architectural depth
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                      Strong Hire
                    </span>
                  </div>
                </div>

                {/* Floating Metric Card */}
                <div className="px-5 py-3 bg-[var(--surface-alt)]/60 border-t border-[var(--border)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-muted)]">Overall Score:</span>
                    <strong className="text-[var(--text)] font-mono text-sm">88.0 / 100</strong>
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer">
                    View Complete Report & Recording →
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            3. STATS STRIP (Requirement 6)
        ───────────────────────────────────────────────────────────── */}
        <section ref={statsRef} className="py-12 border-y border-[var(--border)] bg-[var(--surface-alt)]/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((st, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isStatsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="flex flex-col text-center"
                >
                  <span className="text-3xl sm:text-4xl font-extrabold text-[var(--primary)] font-mono">
                    {st.value}
                  </span>
                  <span className="text-sm font-bold text-[var(--text)] mt-1">
                    {st.label}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] mt-0.5">
                    {st.helper}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            4. HOW IT WORKS SECTION (Requirement 6 - 3 Steps)
        ───────────────────────────────────────────────────────────── */}
        <section ref={howItWorksRef} id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col gap-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={isHowItWorksInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="text-center flex flex-col items-center gap-3 max-w-2xl mx-auto"
            >
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-soft)]/20 px-3 py-1 rounded-full">
                End-to-End Workflow
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text)] tracking-tight">
                How AI Interview Agent Works
              </h2>
              <p className="text-base text-[var(--text-muted)]">
                Screen talent and conduct technical interviews with zero scheduling headaches in three structured stages.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {howItWorksSteps.map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isHowItWorksInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                  transition={{ duration: 0.5, delay: idx * 0.15 }}
                  className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-soft hover:shadow-soft-lg hover:border-[var(--primary-soft)] transition-all flex flex-col gap-4 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-[var(--text-muted)]/40 font-mono">
                      {step.number}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--primary-soft)]/20 text-[var(--primary)] text-xs font-semibold font-mono">
                      {step.badge}
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-[var(--primary-soft)]/20 text-[var(--primary)] flex items-center justify-center">
                    {step.icon}
                  </div>

                  <h3 className="text-lg font-bold text-[var(--text)]">
                    {step.title}
                  </h3>

                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            5. FEATURES GRID (Requirement 6 - 6 Cards)
        ───────────────────────────────────────────────────────────── */}
        <section ref={featuresRef} id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-[var(--surface-alt)]/35">
          <div className="max-w-7xl mx-auto flex flex-col gap-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={isFeaturesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="text-center flex flex-col items-center gap-3 max-w-2xl mx-auto"
            >
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-soft)]/20 px-3 py-1 rounded-full">
                Built For Modern Tech Hiring
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text)] tracking-tight">
                Enterprise AI Interview Features
              </h2>
              <p className="text-base text-[var(--text-muted)]">
                Everything your recruitment team needs to assess candidates objectively, eliminate bias, and accelerate decisions.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feat, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 25 }}
                  animate={isFeaturesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 25 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-soft hover:shadow-soft-lg hover:border-[var(--primary-soft)] transition-all flex flex-col gap-3 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--primary-soft)]/20 text-[var(--primary)] flex items-center justify-center group-hover:scale-105 transition-transform">
                    {feat.icon}
                  </div>
                  <h3 className="text-base font-bold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                    {feat.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            6. ABOUT SECTION
        ───────────────────────────────────────────────────────────── */}
        <section ref={aboutRef} id="about" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={isAboutInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6 flex flex-col gap-6"
            >
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-soft)]/20 px-3 py-1 rounded-full w-fit">
                Our Mission
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text)] tracking-tight">
                Fixing the Broken Technical Interview Process
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
                Traditional recruiting wastes hundreds of engineering hours on repetitive screening loops while candidates wait weeks for basic feedback. Unconscious bias and unstandardized question sets often fail to identify genuine practical problem-solvers.
              </p>
              <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
                AI Interview Agent was created to make tech screening fair, rapid, and delightfully objective. By pairing conversational LLMs with live audio-video analysis and proctoring telemetry, every applicant receives a rigorous, standardized opportunity to showcase their true capability.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-[var(--surface-alt)]/50 border border-[var(--border)]">
                  <span className="font-bold text-base text-[var(--text)]">Fair & Standardized</span>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Identical grading benchmarks for all candidates</p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--surface-alt)]/50 border border-[var(--border)]">
                  <span className="font-bold text-base text-[var(--text)]">Enterprise Ready</span>
                  <p className="text-xs text-[var(--text-muted)] mt-1">SOC2 compliance and strict role-based access</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={isAboutInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6"
            >
              <div className="p-8 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-soft-lg flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">AI Interview Agent Engine</h3>
                    <p className="text-xs text-white/80">Autonomous Evaluation Standard</p>
                  </div>
                </div>

                <blockquote className="text-sm sm:text-base font-medium leading-relaxed italic text-white/95">
                  "Our engineering leaders cut 75% of early technical screening hours while candidate satisfaction surged. The detailed question bookmarks and technical accuracy breakdowns make debriefs instantaneous."
                </blockquote>

                <div className="flex items-center justify-between border-t border-white/20 pt-4 text-xs">
                  <div>
                    <strong className="block text-sm">Engineering Talent Partner</strong>
                    <span className="text-white/80">CloudScale Systems</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/20 text-white font-mono font-bold">
                    88.4 Avg Score
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            7. CONTACT SECTION
        ───────────────────────────────────────────────────────────── */}
        <section ref={contactRef} id="contact" className="py-24 px-4 sm:px-6 lg:px-8 bg-[var(--surface-alt)]/35">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={isContactInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-5 flex flex-col gap-6"
            >
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-soft)]/20 px-3 py-1 rounded-full w-fit">
                Let's Connect
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text)] tracking-tight">
                Request a Custom Walkthrough
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
                Learn how AI Interview Agent can integrate with your ATS, calibrate custom role rubrics, and automate technical assessment for your team.
              </p>

              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-center gap-3 text-sm text-[var(--text)]">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)]/20 text-[var(--primary)] flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <span>contact@aiinterviewagent.com</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--text)]">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)]/20 text-[var(--primary)] flex items-center justify-center">
                    <MapPin size={16} />
                  </div>
                  <span>San Francisco, CA · Remote Global</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--text)]">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)]/20 text-[var(--primary)] flex items-center justify-center">
                    <ShieldCheck size={16} />
                  </div>
                  <span>SOC2 Type II & GDPR Compliant</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={isContactInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="lg:col-span-7 bg-[var(--surface)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-soft"
            >
              {contactSubmitted ? (
                <div className="p-8 text-center flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--success)]/15 text-[var(--success)] flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--text)]">Message Received</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Thank you! Our recruitment solutions specialist will reach out to schedule your personalized product walkthrough.
                  </p>
                </div>
              ) : (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    setContactSubmitted(true);
                  }}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[var(--text)]">Your Full Name</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Alex Morgan" 
                        className="h-10 px-3 bg-[var(--surface-alt)]/40 border border-[var(--border)] text-[var(--text)] rounded-xl text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[var(--text)]">Work Email</label>
                      <input 
                        required
                        type="email" 
                        placeholder="alex@company.com" 
                        className="h-10 px-3 bg-[var(--surface-alt)]/40 border border-[var(--border)] text-[var(--text)] rounded-xl text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[var(--text)]">Company Name</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Acme Tech" 
                        className="h-10 px-3 bg-[var(--surface-alt)]/40 border border-[var(--border)] text-[var(--text)] rounded-xl text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[var(--text)]">Estimated Monthly Hires</label>
                      <select 
                        className="h-10 px-3 bg-[var(--surface-alt)]/40 border border-[var(--border)] text-[var(--text)] rounded-xl text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 cursor-pointer transition-all"
                      >
                        <option value="1-5">1 – 5 hires / month</option>
                        <option value="5-20">5 – 20 hires / month</option>
                        <option value="20+">20+ hires / month</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--text)]">What positions are you hiring for?</label>
                    <textarea 
                      rows={3}
                      placeholder="e.g. Senior Backend Engineers, ML Engineers, Full Stack Developers..."
                      className="p-3 bg-[var(--surface-alt)]/40 border border-[var(--border)] text-[var(--text)] rounded-xl text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 resize-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="h-10 mt-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-semibold shadow-soft hover:shadow-soft-lg transition-all active:scale-[0.98]"
                  >
                    Submit Request
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            8. FINAL CTA BANNER (Requirement 6)
        ───────────────────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto rounded-3xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-soft-lg">
            <div className="max-w-2xl flex flex-col gap-6 relative z-10">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-white/80 bg-white/10 px-3 py-1 rounded-full w-fit">
                Transform Your Technical Hiring
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Ready to accelerate your engineering hiring pipeline?
              </h2>
              <p className="text-base text-white/90">
                Empower your recruiters with autonomous AI interviews, standardized scorecards, and zero scheduling friction.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  onClick={handleGetStarted}
                  className="h-11 px-6 bg-white text-[var(--primary)] hover:bg-[var(--surface-alt)] rounded-xl text-sm font-bold shadow-soft transition-all active:scale-[0.98]"
                >
                  Get Started Free
                </button>
                <button
                  onClick={() => setIsRequestDemoOpen(true)}
                  className="h-11 px-5 border border-white/40 hover:bg-white/15 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  Request a Demo
                </button>
              </div>
            </div>

            {/* Decorative background watermark */}
            <div className="absolute -right-16 -bottom-16 w-96 h-96 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          9. FOOTER (Requirement 9)
      ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand Info */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-soft">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-lg text-[var(--text)]">
                AI Interview Agent
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-sm">
              Autonomous AI-led video interviews and candidate intelligence. Deliver objective, data-driven hiring decisions in hours instead of weeks.
            </p>
            <p className="text-xs text-[var(--text-muted)]/70">
              © {new Date().getFullYear()} AI Interview Agent Inc. All rights reserved.
            </p>
          </div>

          {/* Product Links */}
          <div className="flex flex-col gap-2.5 text-xs">
            <span className="font-bold text-[var(--text)] uppercase tracking-wider font-mono">Product</span>
            <button onClick={() => scrollToSection(howItWorksRef)} className="text-left text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">How It Works</button>
            <button onClick={() => scrollToSection(featuresRef)} className="text-left text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">AI Video Interviews</button>
            <button onClick={() => scrollToSection(featuresRef)} className="text-left text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">Scorecards & Reports</button>
            <button onClick={() => scrollToSection(featuresRef)} className="text-left text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">Proctoring Telemetry</button>
          </div>

          {/* Company Links */}
          <div className="flex flex-col gap-2.5 text-xs">
            <span className="font-bold text-[var(--text)] uppercase tracking-wider font-mono">Company</span>
            <button onClick={() => scrollToSection(aboutRef)} className="text-left text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">About Us</button>
            <button onClick={() => scrollToSection(contactRef)} className="text-left text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">Careers</button>
            <button onClick={() => scrollToSection(contactRef)} className="text-left text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">Enterprise Contact</button>
            <span className="text-[var(--text-muted)]">Security & Trust</span>
          </div>

          {/* Legal Links & Contact */}
          <div className="flex flex-col gap-2.5 text-xs">
            <span className="font-bold text-[var(--text)] uppercase tracking-wider font-mono">Legal & Support</span>
            <span className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer">Privacy Policy</span>
            <span className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer">Terms of Service</span>
            <span className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer">SOC2 Type II</span>
            <a href="mailto:contact@aiinterviewagent.com" className="text-[var(--primary)] font-semibold pt-1">
              contact@aiinterviewagent.com
            </a>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          10. FLOATING CHATBOT (Requirement 7)
          Moved to small floating button at bottom-right corner
      ───────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="mb-3 w-[360px] sm:w-[390px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-soft-lg overflow-hidden"
            >
              {/* Chat Header */}
              <div className="px-4 py-3 bg-[var(--primary)] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <Brain size={16} />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-bold text-xs">AI Interview Agent Assistant</span>
                    <span className="text-[10px] text-white/80 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" /> Online
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Chat Body */}
              <div className="p-2 max-h-[420px] overflow-y-auto">
                <Chatbot 
                  messages={aiChatMessages}
                  delay={1200}
                  startDelay={500}
                  restartDelay={8000}
                />
              </div>

              {/* Chat Footer */}
              <div className="p-3 bg-[var(--surface-alt)]/50 border-t border-[var(--border)] flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)]">Autonomous Recruiter Intelligence</span>
                <button
                  onClick={() => {
                    setIsChatOpen(false);
                    handleGetStarted();
                  }}
                  className="text-[11px] font-bold text-[var(--primary)] hover:underline"
                >
                  Start Interview →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Chat Trigger Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="h-12 px-4 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-soft-lg flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95"
          aria-label="Open AI Assistant"
        >
          <div className="relative">
            <MessageSquare size={18} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--primary)]" />
          </div>
          <span className="text-xs font-bold font-['Plus_Jakarta_Sans',sans-serif]">
            {isChatOpen ? "Close AI Chat" : "AI Assistant"}
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          11. INTERACTIVE DEMO PREVIEW MODAL (Watch Demo CTA)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--surface)] rounded-2xl max-w-3xl w-full border border-[var(--border)] shadow-soft-lg overflow-hidden my-auto"
            >
              <div className="p-4 bg-[var(--surface-alt)]/60 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play size={16} className="text-[var(--primary)]" />
                  <span className="font-bold text-sm text-[var(--text)]">
                    AI Interview Agent Interactive Product Walkthrough
                  </span>
                </div>
                <button
                  onClick={() => setIsDemoModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-[var(--surface-alt)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden flex flex-col items-center justify-center text-center p-6 border border-slate-800">
                  <video 
                    controls
                    autoPlay
                    muted
                    loop
                    className="absolute inset-0 w-full h-full object-cover"
                    src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                  />
                  <div className="absolute inset-0 bg-black/50 pointer-events-none" />
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-soft animate-pulse">
                      <Play size={24} className="ml-1 fill-white" />
                    </div>
                    <span className="text-white font-bold text-base">Live Technical Evaluation in Action</span>
                    <p className="text-xs text-slate-300 max-w-md">
                      Autonomous conversational agent asking technical questions, proctoring candidate activity, and synthesizing scorecards.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-3 rounded-lg bg-[var(--surface-alt)]/50 border border-[var(--border)]">
                    <strong className="block text-[var(--text)] font-mono">1. Video Interview</strong>
                    <span className="text-[var(--text-muted)]">Autonomous voice interaction</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--surface-alt)]/50 border border-[var(--border)]">
                    <strong className="block text-[var(--text)] font-mono">2. 0-100 Grading</strong>
                    <span className="text-[var(--text-muted)]">Standardized technical metrics</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--surface-alt)]/50 border border-[var(--border)]">
                    <strong className="block text-[var(--text)] font-mono">3. Replay Anytime</strong>
                    <span className="text-[var(--text-muted)]">Synchronized question bookmarks</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--surface-alt)]/60 border-t border-[var(--border)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">Want to test the interview room directly?</span>
                <button
                  onClick={() => {
                    setIsDemoModalOpen(false);
                    navigate('/interview');
                  }}
                  className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-semibold shadow-soft transition-all"
                >
                  Open Sandbox Room →
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          12. REQUEST A DEMO MODAL (Navbar CTA)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isRequestDemoOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--surface)] rounded-2xl max-w-md w-full border border-[var(--border)] shadow-soft-lg overflow-hidden my-auto"
            >
              <div className="p-4 bg-[var(--surface-alt)]/60 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[var(--primary)]" />
                  <span className="font-bold text-sm text-[var(--text)]">
                    Request an AI Interview Agent Demo
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsRequestDemoOpen(false);
                    setDemoFormSubmitted(false);
                  }}
                  className="w-8 h-8 rounded-lg bg-[var(--surface-alt)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6">
                {demoFormSubmitted ? (
                  <div className="text-center py-6 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[var(--success)]/15 text-[var(--success)] flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <h4 className="font-bold text-lg text-[var(--text)]">Demo Scheduled!</h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      We've sent a calendar invitation and product guide to your email address.
                    </p>
                    <button
                      onClick={() => {
                        setIsRequestDemoOpen(false);
                        setDemoFormSubmitted(false);
                      }}
                      className="mt-3 px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-xs font-semibold shadow-soft"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setDemoFormSubmitted(true);
                    }}
                    className="flex flex-col gap-3.5"
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[var(--text)]">Full Name</label>
                      <input
                        required
                        type="text"
                        placeholder="Alex Morgan"
                        className="h-9 px-3 bg-[var(--surface-alt)]/40 border border-[var(--border)] text-[var(--text)] rounded-xl text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[var(--text)]">Work Email</label>
                      <input
                        required
                        type="email"
                        placeholder="alex@company.com"
                        className="h-9 px-3 bg-[var(--surface-alt)]/40 border border-[var(--border)] text-[var(--text)] rounded-xl text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[var(--text)]">Company Name</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Acme Tech"
                        className="h-9 px-3 bg-[var(--surface-alt)]/40 border border-[var(--border)] text-[var(--text)] rounded-xl text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      className="h-10 mt-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-semibold shadow-soft hover:shadow-soft-lg transition-all active:scale-[0.98]"
                    >
                      Book 15-Min Live Demo
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;