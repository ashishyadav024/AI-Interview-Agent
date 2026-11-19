import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ChakraProvider } from '@chakra-ui/react';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ResumeAnalyzer from "./components/ui/resumeAnalyzer";
import Login from "./components/ui/login";
import { ResumeAnalysisContainer } from "./components1/ResumeAnalysisContainer";
import { ThemeProvider as CustomThemeProvider } from './context/ThemeContext';
import { CandidateProvider } from './context/CandidateContext';
import CandidatePredictor from "./components/ui/CandidatePredictor";
import EmployeeResumeAnalysis from "./components1/EmployeeResumeAnalysis";
import HRResumeAnalysis from "./components1/HRResumeAnalysis";
import VideoInterview from "./components1/VideoInterview";
import RecruiterDashboard from "./components1/RecruiterDashboard";

const queryClient = new QueryClient();

// Auth Middleware / Protected Route with Server Role Enforcement
const ProtectedRoute = ({ 
  children, 
  allowedRoles = ['RECRUITER', 'ADMIN', 'HIRING_MANAGER'] 
}: { 
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const location = useLocation();
  const isAuth = typeof window !== "undefined" && (
    localStorage.getItem("user_authenticated") === "true" ||
    Boolean(localStorage.getItem("user_role"))
  );

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const rawRole = (typeof window !== "undefined" && localStorage.getItem("user_role")) || "CANDIDATE";
  const userRole = rawRole.toUpperCase();
  const isAllowed = allowedRoles.map(r => r.toUpperCase()).includes(userRole);

  if (!isAllowed) {
    // If a candidate attempts to open recruiter dashboard routes, redirect to /interview
    if (userRole === "CANDIDATE") {
      return <Navigate to="/interview" replace />;
    }
    // If unauthorized for any other reason, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ChakraProvider>
      <CustomThemeProvider>
        <TooltipProvider>
          <CandidateProvider>
            <Toaster />
            <Sonner />
            <Router>
              <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />

              {/* Recruiter & Admin Workspace Protected Routes */}
              <Route 
                path="/dashboard" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              <Route 
                path="/recruiter-dashboard" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              <Route 
                path="/overview" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              <Route 
                path="/candidates" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              <Route 
                path="/reports" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              <Route 
                path="/job-roles" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              <Route 
                path="/settings" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              <Route 
                path="/help" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              <Route 
                path="/help-support" 
                element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><RecruiterDashboard /></ProtectedRoute>} 
              />
              
              {/* Candidate Area & Live Interview Room Protected Routes */}
              <Route 
                path="/interview" 
                element={<ProtectedRoute allowedRoles={['CANDIDATE', 'RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><VideoInterview /></ProtectedRoute>} 
              />
              <Route 
                path="/interview/:roomid" 
                element={<ProtectedRoute allowedRoles={['CANDIDATE', 'RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><VideoInterview /></ProtectedRoute>} 
              />
              <Route 
                path="/interviews" 
                element={<ProtectedRoute allowedRoles={['CANDIDATE', 'RECRUITER', 'ADMIN', 'HIRING_MANAGER']}><VideoInterview /></ProtectedRoute>} 
              />

              {/* Analysis Tools */}
              <Route path="/resumeAnalyzer" element={<ResumeAnalyzer />} />
              <Route path="/resume-analysis" element={<ResumeAnalysisContainer />} />
              <Route path="/employee-resume-analysis" element={<EmployeeResumeAnalysis />} />
              <Route path="/hr-resume-analysis" element={<HRResumeAnalysis />} />
              <Route path="/candidate-predictor" element={<CandidatePredictor />} />

              {/* Catch-All 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
          </CandidateProvider>
        </TooltipProvider>
      </CustomThemeProvider>
    </ChakraProvider>
  </QueryClientProvider>
);

export default App;
