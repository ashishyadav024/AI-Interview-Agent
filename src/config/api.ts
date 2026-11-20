// API configuration for the application

// Primary Backend API URL (supports VITE_FASTAPI_BASE_URL, VITE_API_URL, or VITE_API_BASE_URL)
const rawFastApiUrl = 
  import.meta.env.VITE_FASTAPI_BASE_URL || 
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:8001' : window.location.origin);

// Base URL for FastAPI backend (strips any trailing slash)
export const FASTAPI_BASE_URL = rawFastApiUrl.replace(/\/+$/, '');

// Base URL for auxiliary services (defaults to FASTAPI_BASE_URL)
export const API_BASE_URL = (
  import.meta.env.VITE_FLASK_API_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  FASTAPI_BASE_URL
).replace(/\/+$/, '');

// WebSocket Base URL (wss: for https:, ws: for http:)
const defaultWsUrl = FASTAPI_BASE_URL.replace(/^http/, 'ws');
export const WS_BASE_URL = (import.meta.env.VITE_WS_URL || defaultWsUrl).replace(/\/+$/, '');

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  auth: `${FASTAPI_BASE_URL}/api/auth`,
  authLogin: `${FASTAPI_BASE_URL}/api/auth/login`,
  authRegister: `${FASTAPI_BASE_URL}/api/auth/register`,
  authMe: `${FASTAPI_BASE_URL}/api/auth/me`,
  authLogout: `${FASTAPI_BASE_URL}/api/auth/logout`,

  // Resume Analysis & Prediction
  analyze: `${FASTAPI_BASE_URL}/api/analyze`,
  analyzeCareerPath: `${API_BASE_URL}/api/analyze-career-path`,
  predictJob: `${API_BASE_URL}/api/predict-job`,
  analyzeSkillGap: `${API_BASE_URL}/api/analyze-skill-gap`,
  qa: `${API_BASE_URL}/api/qa`,
  questions: `${API_BASE_URL}/api/questions`,
  improve: `${API_BASE_URL}/api/improve`,
  improvedResume: `${API_BASE_URL}/api/improved-resume`,
  generateMessage: `${API_BASE_URL}/api/generate-message`,
  processAction: `${API_BASE_URL}/api/process-action`,
  sendAcceptance: `${API_BASE_URL}/api/send-acceptance`,
  downloadCsv: `${API_BASE_URL}/api/download-csv`,
  testExtraction: `${API_BASE_URL}/api/extract-text`,
  testSimilarity: `${API_BASE_URL}/api/test-similarity`,
  predictSalary: `${API_BASE_URL}/api/predict-salary`,
  predictJobPossibility: `${API_BASE_URL}/api/predict-job-possibility`,

  // FastAPI AI Interview Endpoints
  interviewStart: `${FASTAPI_BASE_URL}/api/interview/start`,
  interviewAnswer: `${FASTAPI_BASE_URL}/api/interview/answer`,
  interviewHealth: `${FASTAPI_BASE_URL}/health`,
  interviewCreateLink: `${FASTAPI_BASE_URL}/api/interviews/create-link`,
  interviewVerifyLink: (roomId: string) => `${FASTAPI_BASE_URL}/api/interviews/verify-link/${roomId}`,

  // Candidates Endpoints (Single Source of Truth)
  candidates: `${FASTAPI_BASE_URL}/api/candidates`,
  candidateById: (candidateId: string) => `${FASTAPI_BASE_URL}/api/candidates/${candidateId}`,
  candidatesReject: `${FASTAPI_BASE_URL}/api/candidates/reject`,
  candidatesUndoReject: `${FASTAPI_BASE_URL}/api/candidates/undo-reject`,
  candidatesShortlist: `${FASTAPI_BASE_URL}/api/candidates/shortlist`,
  
  // Health & Diagnostics
  health: `${FASTAPI_BASE_URL}/api/health`,
  dbHealth: `${FASTAPI_BASE_URL}/api/health/db`,
  llmHealth: `${FASTAPI_BASE_URL}/api/health/llm`,
};
