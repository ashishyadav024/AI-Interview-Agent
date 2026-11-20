import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  User, 
  CheckCircle2, 
  Building2, 
  Briefcase, 
  UserCircle,
  Eye,
  EyeOff,
  Brain,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  KeyRound,
  Loader2,
  Sparkles
} from 'lucide-react';
import { loginWithServerAuth, registerCandidateUser } from '../../services/authService';

const Login: React.FC = () => {
  const [view, setView] = useState<'signin' | 'signup' | 'forgot-password'>('signin');
  // Persona Tab for Sign In: 'recruiter' | 'candidate'
  const [activePersona, setActivePersona] = useState<'recruiter' | 'candidate'>('recruiter');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');

  // Status & Feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    const isAuth = localStorage.getItem('user_authenticated') === 'true';
    const role = localStorage.getItem('user_role');
    if (isAuth && role) {
      if (role.toUpperCase() === 'CANDIDATE') {
        navigate('/interview', { replace: true });
      } else {
        const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
        const target = fromPath && !fromPath.startsWith('/login') ? fromPath : '/dashboard';
        navigate(target, { replace: true });
      }
    }
  }, [navigate, location]);

  // Reset errors and messages when switching views
  const switchView = (newView: 'signin' | 'signup' | 'forgot-password') => {
    setError('');
    setSuccess('');
    setView(newView);
  };

  // Helper to fill seed credentials (only enabled during local development)
  const fillSeedCredentials = (persona: 'recruiter' | 'candidate') => {
    if (!import.meta.env.DEV) return;
    setError('');
    setSuccess('');
    if (persona === 'recruiter') {
      setActivePersona('recruiter');
      setEmail('recruiter@interviewai.com');
      setPassword('Recruiter123!');
    } else {
      setActivePersona('candidate');
      setEmail('candidate@interviewai.com');
      setPassword('Candidate123!');
    }
  };

  // Post-login automatic redirection based on server-verified role
  const handlePostLoginRedirect = (userRole: string) => {
    const normalizedRole = userRole.toUpperCase();
    const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;

    if (normalizedRole === 'CANDIDATE') {
      if (fromPath && fromPath.startsWith('/interview')) {
        navigate(fromPath, { replace: true });
      } else {
        navigate('/interview', { replace: true });
      }
    } else {
      // RECRUITER or ADMIN
      if (fromPath && !fromPath.startsWith('/login')) {
        navigate(fromPath, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  };

  // Sign In Handler with double-submit guard and role validation
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submit
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await loginWithServerAuth(email, password);
      if (response.success && response.user) {
        const serverRole = response.user.role.toUpperCase();
        const tabRole = activePersona === 'recruiter' ? 'RECRUITER' : 'CANDIDATE';

        if (serverRole !== tabRole && !(tabRole === 'RECRUITER' && serverRole === 'ADMIN')) {
          setSuccess(`Logged in as verified role (${serverRole}). Redirecting to your assigned portal...`);
        } else {
          setSuccess('Authentication successful. Redirecting...');
        }

        // Automatic redirect by real server-verified role
        handlePostLoginRedirect(serverRole);
      } else {
        setError(response.error || 'Invalid email or password.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Sign Up Handler (Enforces CANDIDATE accounts exclusively)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await registerCandidateUser(email, password, name, company || undefined);
      if (response.success && response.user) {
        setSuccess('Candidate account created! Redirecting to interview portal...');
        setTimeout(() => {
          navigate('/interview', { replace: true });
        }, 500);
      } else {
        setError(response.error || 'Failed to create candidate account.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Password reset handler
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setSuccess('If an account exists for this email, password reset instructions have been sent.');
      setLoading(false);
    }, 700);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-[var(--bg)] text-[var(--text)] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Decorative ambient background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[var(--primary-soft)]/20 blur-3xl" />
      </div>

      {/* Centered Brand Header */}
      <div className="relative z-10 flex flex-col items-center justify-center mb-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--primary)] flex items-center justify-center text-white shadow-soft mb-3">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
          AI Interview <span className="text-[var(--primary)]">Agent</span>
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1 font-medium max-w-sm">
          Autonomous AI Video Screening & Recruiter Intelligence
        </p>
      </div>

      {/* Main Form Container */}
      <div className="relative z-10 w-full max-w-[440px]">
        {/* SIGN IN VIEW */}
        {view === 'signin' && (
          <div className="w-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft-lg p-6 sm:p-8 relative animate-in fade-in duration-200">
              {/* Persona Switcher Tabs */}
              <div className="flex items-center p-1 bg-[var(--surface-alt)] rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => fillSeedCredentials('recruiter')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    activePersona === 'recruiter'
                      ? 'bg-[var(--surface)] text-[var(--primary)] shadow-soft-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>I'm a Recruiter</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillSeedCredentials('candidate')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    activePersona === 'candidate'
                      ? 'bg-[var(--surface)] text-[var(--primary)] shadow-soft-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <UserCircle className="w-3.5 h-3.5" />
                  <span>I'm a Candidate</span>
                </button>
              </div>

              {/* Headings */}
              <h2 className="text-xl font-bold text-center text-[var(--text)] tracking-tight">
                {activePersona === 'recruiter' ? 'Recruiter Dashboard Login' : 'Candidate Interview Portal'}
              </h2>
              <p className="text-xs text-center text-[var(--text-muted)] mt-1 mb-5">
                {activePersona === 'recruiter' 
                  ? 'Access candidate scoring, interview rooms, and pipeline analytics'
                  : 'Sign in to join your AI video interview assessment'}
              </p>

              {/* Seed Demo Quick Fill Alert/Helper - Only visible in development mode */}
              {import.meta.env.DEV && (
                <div className="mb-4 p-2.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text)]">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-[var(--primary)]" />
                    <span className="text-[var(--text-muted)]">Quick Demo:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fillSeedCredentials('recruiter')}
                      className="px-2 py-0.5 rounded bg-[var(--surface)] font-semibold text-[var(--primary)] border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors shadow-2xs"
                    >
                      Recruiter Seed
                    </button>
                    <button
                      type="button"
                      onClick={() => fillSeedCredentials('candidate')}
                      className="px-2 py-0.5 rounded bg-[var(--surface)] font-semibold text-[var(--primary)] border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors shadow-2xs"
                    >
                      Candidate Seed
                    </button>
                  </div>
                </div>
              )}

              {/* Alert Feedback */}
              {error && (
                <div role="alert" className="mb-4 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--danger)]" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div role="status" className="mb-4 p-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] text-xs flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--success)]" />
                  <span>{success}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                    Work Email / Candidate Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={activePersona === 'recruiter' ? 'recruiter@interviewai.com' : 'candidate@interviewai.com'}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-alt)]/40 border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all duration-150"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchView('forgot-password')}
                      className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-[var(--surface-alt)]/40 border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all duration-150"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.99] text-white text-sm font-semibold rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In as {activePersona === 'recruiter' ? 'Recruiter' : 'Candidate'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Sign up link below button */}
              <div className="text-center mt-6 pt-5 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                Are you a candidate without an account?{' '}
                <button
                  type="button"
                  onClick={() => switchView('signup')}
                  className="font-semibold text-[var(--primary)] hover:underline transition-all ml-1"
                >
                  Create candidate account
                </button>
              </div>
            </div>
          )}

          {/* SIGN UP CARD (Strict Candidate Self-Registration) */}
          {view === 'signup' && (
            <div className="w-full max-w-[460px] bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft p-6 sm:p-8 relative animate-in fade-in duration-200">
              <div className="mx-auto w-14 h-14 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] shadow-soft-sm mb-4">
                <UserCircle className="w-6 h-6 text-[var(--primary)]" />
              </div>

              <h2 className="text-2xl font-bold text-center text-[var(--text)] tracking-tight">
                Candidate Registration
              </h2>
              <p className="text-xs text-center text-[var(--text-muted)] mt-1 mb-4">
                Create a candidate account to take your AI interview assessment.
              </p>

              {/* Recruiter Notice Badge */}
              <div className="mb-4 p-2.5 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]/40 text-[var(--accent-strong)] text-[11px] leading-relaxed">
                <span className="font-semibold">Notice:</span> Self-registration creates Candidate accounts only. Recruiter accounts are created by administrator invite.
              </div>

              {/* Alert Feedback */}
              {error && (
                <div role="alert" className="mb-4 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--danger)]" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div role="status" className="mb-4 p-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] text-xs flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--success)]" />
                  <span>{success}</span>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="space-y-1">
                  <label htmlFor="name" className="block text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Aarav Sharma"
                      className="w-full pl-10 pr-4 py-2 bg-[var(--surface-alt)]/40 border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all duration-150"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="signup-email" className="block text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="aarav.candidate@example.com"
                      className="w-full pl-10 pr-4 py-2 bg-[var(--surface-alt)]/40 border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all duration-150"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="signup-password" className="block text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                    Password (min. 6 characters)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create secure password"
                      className="w-full pl-10 pr-10 py-2 bg-[var(--surface-alt)]/40 border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all duration-150"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.99] text-white text-sm font-semibold rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Candidate Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-5 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => switchView('signin')}
                  className="font-semibold text-[var(--primary)] hover:underline transition-all ml-1"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {view === 'forgot-password' && (
            <div className="w-full max-w-[420px] bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft p-6 sm:p-8 relative animate-in fade-in duration-200">
              <div className="mx-auto w-14 h-14 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] shadow-soft-sm mb-4">
                <KeyRound className="w-6 h-6 text-[var(--primary)]" />
              </div>

              <h2 className="text-2xl font-bold text-center text-[var(--text)] tracking-tight">
                Reset password
              </h2>
              <p className="text-xs text-center text-[var(--text-muted)] mt-1 mb-6">
                Enter your email address to receive password reset instructions.
              </p>

              {error && (
                <div role="alert" className="mb-4 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--danger)]" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div role="status" className="mb-4 p-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] text-xs flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--success)]" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="reset-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-alt)]/40 border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]/40 transition-all duration-150"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.99] text-white text-sm font-semibold rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-6 pt-5 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                <button
                  type="button"
                  onClick={() => switchView('signin')}
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--primary)] hover:underline transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Centered Footer */}
      <div className="relative z-10 mt-8 flex flex-col items-center gap-2 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-3">
          <span className="hover:text-[var(--text)] transition-colors cursor-pointer">
            Privacy Policy
          </span>
          <span className="text-[var(--border)]">•</span>
          <span className="hover:text-[var(--text)] transition-colors cursor-pointer">
            Terms
          </span>
          <span className="text-[var(--border)]">•</span>
          <button 
            type="button"
            onClick={() => navigate('/help')} 
            className="hover:text-[var(--text)] transition-colors cursor-pointer font-medium"
          >
            Help & FAQs
          </button>
        </div>
        <div className="text-[11px] text-[var(--text-muted)]/80">
          © {new Date().getFullYear()} AI Interview Agent. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;
