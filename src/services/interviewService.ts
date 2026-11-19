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
};
