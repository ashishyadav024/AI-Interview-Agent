import { API_ENDPOINTS, FASTAPI_BASE_URL } from '../config/api';

export interface InterviewStartRequest {
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  job_description?: string;
  required_skills?: string[];
  candidate_resume?: string;
  interview_id?: string;
  session_id?: string;
  meeting_id?: string;
  target_duration_minutes?: number;
}

export interface InterviewStartResponse {
  success: boolean;
  data?: {
    interview_id: string;
    session_id: string;
    introduction: string;
    current_stage: string;
    processing_status?: string;
    plan?: {
      target_questions?: number;
      skills_to_cover?: string[];
      starting_difficulty?: string;
      stages?: string[];
    };
  };
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AnswerEvaluation {
  overall_score?: number;
  score_0_10?: number;
  clarity?: string;
  technical_depth?: string;
  correctness?: string;
  completeness_score?: number;
  relevance_score?: number;
  technical_score?: number;
  communication_score?: number;
  problem_solving_score?: number;
  strengths?: string[];
  weaknesses?: string[];
  gaps?: string[];
  mentioned_new_topics?: string[];
  confidence?: string;
  cheating_signals_hint?: string;
  feedback?: string;
  key_points_mentioned?: string[];
  technical_terms_used?: string[];
  red_flags?: string[];
  follow_up_needed?: boolean;
  follow_up_reason?: string;
  suggested_followup?: string;
}

export interface InterviewAnswerRequest {
  interview_id: string;
  answer: string;
  is_skipped?: boolean;
  transcription_id?: string;
}

export interface InterviewReport {
  report_id: string;
  interview_id: string;
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  interview_date: string;
  total_questions: number;
  duration_minutes: number;
  scores: {
    overall: number;
    technical: number;
    communication: number;
    problem_solving: number;
    cultural_fit: number;
  };
  recommendation: string;
  summary: string;
  key_strengths: string[];
  areas_for_improvement: string[];
  questions_summary: Array<{
    question_number: number;
    question: string;
    stage: string;
    answer: string;
    score: number;
    feedback: string;
    difficulty?: string;
    topic?: string;
  }>;
  closing_message: string;
}

export interface InterviewAnswerResponse {
  success: boolean;
  data?: {
    is_finished?: boolean;
    interview_complete?: boolean;
    question?: string;
    next_question?: string;
    question_number?: number;
    total_questions?: number;
    current_stage?: string;
    stage_progress?: string;
    closing_message?: string;
    message?: string;
  };
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const interviewService = {
  /**
   * Start a new AI interview session via FastAPI backend (Port 8001)
   */
  async startInterview(request: InterviewStartRequest): Promise<InterviewStartResponse> {
    try {
      const response = await fetch(API_ENDPOINTS.interviewStart, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || (data && data.success === false)) {
        return {
          success: false,
          error: data?.error || {
            code: 'HTTP_ERROR',
            message: data?.message || `HTTP ${response.status}: Failed to start interview`,
          },
          message: data?.message || 'Failed to start interview',
        };
      }

      return data || { success: false, error: { code: 'INVALID_RESPONSE', message: 'Empty response from server' } };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: errMsg || 'Unable to connect to interview service on port 8001.',
        },
        message: errMsg || 'Network connection failed',
      };
    }
  },

  /**
   * Submit candidate answer and receive evaluation + next question (Port 8001)
   */
  async submitAnswer(request: InterviewAnswerRequest): Promise<InterviewAnswerResponse> {
    try {
      const response = await fetch(API_ENDPOINTS.interviewAnswer, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || (data && data.success === false)) {
        return {
          success: false,
          error: data?.error || {
            code: 'HTTP_ERROR',
            message: data?.message || `HTTP ${response.status}: Failed to process answer`,
          },
          message: data?.message || 'Failed to process answer',
        };
      }

      return data || { success: false, error: { code: 'INVALID_RESPONSE', message: 'Empty response from server' } };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: errMsg || 'Unable to connect to interview service on port 8001.',
        },
        message: errMsg || 'Network connection failed',
      };
    }
  },

  /**
   * Submit candidate answer and stream next question token by token
   */
  async submitAnswerStream(
    request: InterviewAnswerRequest,
    onToken: (token: string) => void,
    onFirstSentence: (sentence: string) => void,
    onComplete: (data: InterviewAnswerResponse['data']) => void,
    onError: (err: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/api/interview/answer/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        onError(errJson?.detail || `HTTP ${response.status}: Failed to process answer`);
        return;
      }

      if (!response.body) {
        onError("No response body received for streaming");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            try {
              const payload = JSON.parse(trimmed.slice(5).trim());
              if (payload.event === "token" && payload.token) {
                onToken(payload.token);
              } else if (payload.event === "first_sentence" && payload.sentence) {
                onFirstSentence(payload.sentence);
              } else if (payload.event === "done") {
                onComplete(payload);
              } else if (payload.event === "error") {
                onError(payload.message || "Streaming error");
              }
            } catch {
              // Ignore non-json lines
            }
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      onError(errMsg || "Streaming connection failed");
    }
  },

  /**
   * Fetch generated evaluation report for an interview
   */
  async getReport(interviewId: string): Promise<{ success: boolean; data?: InterviewReport; message?: string }> {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/api/interview/${interviewId}/report`);
      if (!response.ok) return { success: false };
      return response.json();
    } catch (e) {
      return { success: false };
    }
  },

  /**
   * Recruiter schedules new interview with secure hashed token
   */
  async scheduleInterview(payload: {
    candidate_name: string;
    candidate_email: string;
    job_role: string;
    job_description?: string;
    skills?: string[];
    resume_text?: string;
    resume_filename?: string;
    expires_in_hours?: number;
    is_demo?: boolean;
  }): Promise<{
    success: boolean;
    token?: string;
    interview_url?: string;
    expires_at?: string;
    expires_in_hours?: number;
    candidate?: any;
    error?: string;
  }> {
    try {
      const userRole = localStorage.getItem("user_role") || "RECRUITER";
      const token = localStorage.getItem("auth_token") || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-User-Role": userRole,
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${FASTAPI_BASE_URL}/api/interviews/schedule`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        return { success: false, error: err?.detail || `Failed to schedule: HTTP ${response.status}` };
      }
      return await response.json();
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error scheduling interview" };
    }
  },

  /**
   * Validate interview token on the server (Read-only, single-use, non-expired)
   */
  async validateToken(token: string): Promise<{
    valid: boolean;
    reason?: "not_found" | "cancelled" | "completed" | "expired" | "missing";
    message?: string;
    candidate?: {
      id: string;
      name: string;
      email: string;
      role: string;
      job_description?: string;
      skills?: string[];
      resume_text?: string;
      expires_at?: string;
      status?: string;
      is_demo?: boolean;
    };
  }> {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/api/interviews/validate/${encodeURIComponent(token)}`);
      if (!response.ok) {
        return { valid: false, reason: "not_found", message: "Failed to validate interview link." };
      }
      return await response.json();
    } catch (err: unknown) {
      return { valid: false, reason: "not_found", message: "Cannot connect to server to validate link." };
    }
  },

  /**
   * Start interview session upon candidate device consent
   */
  async startSession(token: string): Promise<{ success: boolean; status?: string; message?: string }> {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/api/interviews/start-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return await response.json();
    } catch {
      return { success: false, message: "Network error" };
    }
  },

  /**
   * Complete interview session upon final answer
   */
  async completeSession(token: string): Promise<{ success: boolean; status?: string }> {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/api/interviews/complete-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return await response.json();
    } catch {
      return { success: false };
    }
  },

  /**
   * Send interview invitation email to candidate
   */
  async sendInviteEmail(payload: {
    candidate_email: string;
    candidate_name: string;
    job_title: string;
    interview_url: string;
    expires_at?: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const userRole = localStorage.getItem("user_role") || "RECRUITER";
      const token = localStorage.getItem("auth_token") || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-User-Role": userRole,
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${FASTAPI_BASE_URL}/api/interviews/send-invite-email`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      return await response.json();
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to send email" };
    }
  },

  /**
   * Extend expiry of a scheduled interview
   */
  async extendExpiry(candidateId: string, additionalHours: number = 48): Promise<{ success: boolean; new_expires_at?: string }> {
    try {
      const userRole = localStorage.getItem("user_role") || "RECRUITER";
      const token = localStorage.getItem("auth_token") || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-User-Role": userRole,
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${FASTAPI_BASE_URL}/api/interviews/${encodeURIComponent(candidateId)}/extend-expiry`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ additional_hours: additionalHours }),
      });
      return await response.json();
    } catch {
      return { success: false };
    }
  },

  /**
   * Cancel a scheduled interview
   */
  async cancelInterview(candidateId: string): Promise<{ success: boolean; status?: string }> {
    try {
      const userRole = localStorage.getItem("user_role") || "RECRUITER";
      const token = localStorage.getItem("auth_token") || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-User-Role": userRole,
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${FASTAPI_BASE_URL}/api/interviews/${encodeURIComponent(candidateId)}/cancel`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      return await response.json();
    } catch {
      return { success: false };
    }
  },
};
