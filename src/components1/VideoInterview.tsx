import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { 
  Bot, 
  User, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  Award, 
  RotateCcw,
  Briefcase,
  Clock,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  RotateCw,
  Printer,
  Download,
  FileText,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FASTAPI_BASE_URL } from "@/config/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { interviewService, AnswerEvaluation, InterviewReport } from "@/services/interviewService";
import { InterviewLayout } from "./InterviewLayout";

// Polyfill interfaces for browser SpeechRecognition
interface SpeechRecognitionResultItem {
  transcript: string;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: {
    [subIndex: number]: SpeechRecognitionResultItem;
  };
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorLike {
  error: string;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    __simulateVoiceTranscript?: (text: string) => void;
  }
}

interface VideoInterviewProps {
  roomid?: boolean;
  isRoom?: boolean;
}

interface MessageItem {
  role: 'ai' | 'candidate';
  content: string;
  stage?: string;
  questionNumber?: number;
  evaluation?: AnswerEvaluation;
}

const VideoInterview: React.FC<VideoInterviewProps> = () => {
  const { roomid: urlRoomid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as {
    candidateName?: string;
    candidateEmail?: string;
    jobTitle?: string;
    skills?: string[];
    candidateResume?: string;
    jobDescription?: string;
  } | null;

  // Setup state pre-populated from screening hand-off (or empty if not available)
  const [candidateName, setCandidateName] = useState<string>(
    locationState?.candidateName ?? (urlRoomid ? decodeURIComponent(urlRoomid) : "")
  );
  const [candidateEmail, setCandidateEmail] = useState<string>(
    locationState?.candidateEmail ?? ""
  );
  const [jobTitle, setJobTitle] = useState<string>(
    locationState?.jobTitle ?? ""
  );
  const [candidateSkills, setCandidateSkills] = useState<string[]>(
    locationState?.skills ?? []
  );
  const [candidateResume, setCandidateResume] = useState<string>(
    locationState?.candidateResume ?? ""
  );
  const [jobDescription, setJobDescription] = useState<string>(
    locationState?.jobDescription ?? ""
  );
  
  // User Session & Role Check
  const rawRole = (typeof window !== "undefined" && localStorage.getItem("user_role")) || "CANDIDATE";
  const userRole = rawRole.toUpperCase();
  const isCandidate = userRole === "CANDIDATE";
  const isDemo = urlRoomid === "demo-sandbox";
  const storedUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("auth_user") || "null") : null;
  const loggedInName = storedUser?.name || (isCandidate ? "Candidate User" : "Alex Morgan");
  const loggedInEmail = storedUser?.email || "";

  // Token Validation State (Requirement 4 & 5)
  const [tokenValidationState, setTokenValidationState] = useState<{
    status: "validating" | "valid" | "invalid";
    reason?: "not_found" | "cancelled" | "completed" | "expired" | "missing";
    message?: string;
  }>({
    status: isDemo ? "valid" : !urlRoomid ? "invalid" : "validating",
    reason: !urlRoomid ? "missing" : undefined,
    message: !urlRoomid ? "Please open the interview link sent by your recruiter." : undefined,
  });

  const [consentChecked, setConsentChecked] = useState(false);
  const [cameraChecked, setCameraChecked] = useState(false);
  const [micChecked, setMicChecked] = useState(false);
  const [inputToken, setInputToken] = useState("");

  const handleJoinFromInput = () => {
    if (!inputToken.trim()) return;
    const raw = inputToken.trim();
    const tokenMatch = raw.match(/\/interview\/([^\/\?#]+)/);
    const token = tokenMatch ? tokenMatch[1] : raw;
    navigate(`/interview/${encodeURIComponent(token)}`);
  };

  // Auto-fill candidate info if logged in as Candidate and not set
  useEffect(() => {
    if (isCandidate) {
      if (!candidateName && loggedInName && loggedInName !== "Candidate User") {
        setCandidateName(loggedInName);
      }
      if (!candidateEmail && loggedInEmail) {
        setCandidateEmail(loggedInEmail);
      }
    }
  }, [isCandidate, loggedInName, loggedInEmail, candidateName, candidateEmail]);

  const handleCandidateLogout = () => {
    localStorage.removeItem("user_authenticated");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("user_role");
    localStorage.removeItem("auth_token");
    navigate("/login", { replace: true });
  };

  // Interview runtime state
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewId, setInterviewId] = useState<string>("");
  const [currentStage, setCurrentStage] = useState<string>("intro");
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentDifficulty, setCurrentDifficulty] = useState<string>("medium");
  const [currentTopic, setCurrentTopic] = useState<string>("Introduction");
  const [questionType, setQuestionType] = useState<string>("main");
  const [llmUnavailable, setLlmUnavailable] = useState<boolean>(false);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState<string>("");
  const [isAudioTextMode, setIsAudioTextMode] = useState<boolean>(false);
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [totalQuestions, setTotalQuestions] = useState<number>(6);
  const [answerText, setAnswerText] = useState<string>("");
  
  // Feedback and completion state
  const [conversationHistory, setConversationHistory] = useState<MessageItem[]>([]);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [interviewReport, setInterviewReport] = useState<InterviewReport | null>(null);
  const [closingMessage, setClosingMessage] = useState<string>("");
  const [finalScore, setFinalScore] = useState<number>(0);

  // Status & Error state
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server-side token validation (Requirement 4: exists, not expired, not cancelled, not completed)
  useEffect(() => {
    if (!urlRoomid) {
      setTokenValidationState({
        status: "invalid",
        reason: "missing",
        message: "Please open the interview link sent by your recruiter.",
      });
      return;
    }

    if (urlRoomid === "demo-sandbox") {
      setCandidateName("Demo Candidate");
      setCandidateEmail("demo.recruiter@example.com");
      setJobTitle("Full Stack Developer (Demo Sandbox)");
      setJobDescription("Full-stack engineering assessment sandbox for recruiter testing.");
      setCandidateSkills(["React", "Node.js", "System Architecture", "TypeScript"]);
      setTokenValidationState({ status: "valid" });
      return;
    }

    interviewService.validateToken(urlRoomid)
      .then((res) => {
        if (res.valid && res.candidate) {
          setCandidateName(res.candidate.name || "");
          setCandidateEmail(res.candidate.email || "");
          setJobTitle(res.candidate.role || "");
          setJobDescription(res.candidate.job_description || "");
          if (res.candidate.skills && Array.isArray(res.candidate.skills)) {
            setCandidateSkills(res.candidate.skills);
          }
          if (res.candidate.resume_text) {
            setCandidateResume(res.candidate.resume_text);
          }
          setTokenValidationState({ status: "valid" });
        } else {
          setTokenValidationState({
            status: "invalid",
            reason: res.reason || "not_found",
            message: res.message || "Invalid or unrecognized interview link.",
          });
        }
      })
      .catch(() => {
        // Fallback to client-side localStorage invitation cache if backend is unreachable
        try {
          const stored = localStorage.getItem("ai_interview_invitations");
          if (stored) {
            const parsed = JSON.parse(stored);
            const invite = parsed[urlRoomid];
            if (invite) {
              if (invite.expires_at_timestamp && Date.now() > invite.expires_at_timestamp) {
                setTokenValidationState({
                  status: "invalid",
                  reason: "expired",
                  message: "This single-use interview invitation has expired. Please contact your recruiter for a new link.",
                });
                return;
              }
              if (invite.is_used || invite.status === "Completed") {
                setTokenValidationState({
                  status: "invalid",
                  reason: "completed",
                  message: "This single-use interview link has already been used and completed.",
                });
                return;
              }
              if (invite.status === "Cancelled") {
                setTokenValidationState({
                  status: "invalid",
                  reason: "cancelled",
                  message: "This interview invitation has been cancelled by the recruiter.",
                });
                return;
              }
              setCandidateName(invite.candidate_name || "");
              setCandidateEmail(invite.candidate_email || "");
              setJobTitle(invite.job_role || "");
              setJobDescription(invite.job_description || "");
              if (invite.skills && Array.isArray(invite.skills)) {
                setCandidateSkills(invite.skills);
              }
              setTokenValidationState({ status: "valid" });
              return;
            }
          }
        } catch (e) {
          console.warn("Could not load fallback invitation token from localStorage:", e);
        }

        setTokenValidationState({
          status: "invalid",
          reason: "not_found",
          message: "Unable to connect to the server to validate your interview invitation.",
        });
      });
  }, [urlRoomid]);

  // Voice Interaction state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean>(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const textBeforeSpeechRef = useRef<string>("");

  // Webcam state
  type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'off';
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // TTS state
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
    }

    // Expose test helper for automated test environments
    window.__simulateVoiceTranscript = (text: string) => {
      setAnswerText((prev) => (prev.trim() ? `${prev.trim()} ${text.trim()}` : text.trim()));
    };

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      delete window.__simulateVoiceTranscript;
    };
  }, []);

  // Webcam helpers
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unavailable');
      setCameraError('Camera not supported in this browser.');
      return;
    }
    setCameraStatus('requesting');
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus('active');
      setIsAudioTextMode(false);
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      if (errorObj?.name === 'NotAllowedError' || errorObj?.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setCameraError('Camera permission was blocked. You can continue in audio/text mode or allow camera access in browser permissions.');
      } else if (errorObj?.name === 'NotFoundError' || errorObj?.name === 'DevicesNotFoundError') {
        setCameraStatus('unavailable');
        setCameraError('No camera detected. You can continue the interview in audio/text mode.');
      } else {
        setCameraStatus('unavailable');
        setCameraError(`Camera error: ${errorObj?.message || 'Unable to access video stream'}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus('off');
    setCameraError(null);
  }, []);

  // Start camera when interview begins
  useEffect(() => {
    if (interviewStarted) {
      startCamera();
    }
  }, [interviewStarted, startCamera]);

  // Stop all camera tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // TTS helpers
  const stopSpeaking = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, [ttsSupported]);

  const speakQuestion = useCallback((text: string) => {
    if (!ttsSupported || !text.trim()) return;
    // Cancel any in-progress speech first
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;   // Slightly slower than default for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Prefer a natural English voice if available; fall back to browser default
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [ttsSupported]);

  // Auto-speak when a new AI question arrives
  useEffect(() => {
    if (interviewStarted && currentQuestion) {
      // Small delay to let voices load on first render
      const timer = setTimeout(() => speakQuestion(currentQuestion), 300);
      return () => clearTimeout(timer);
    }
  }, [currentQuestion, interviewStarted, speakQuestion]);

  // Cancel TTS on unmount
  useEffect(() => {
    return () => {
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [ttsSupported]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setVoiceError("Speech recognition is not supported in this browser. Please type your answer.");
      return;
    }

    setVoiceError(null);
    textBeforeSpeechRef.current = answerText;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        const base = textBeforeSpeechRef.current.trim();
        const combined = base ? `${base} ${currentTranscript.trim()}` : currentTranscript.trim();
        setAnswerText(combined);
      };

      recognition.onerror = (event: SpeechRecognitionErrorLike) => {
        console.warn("Speech recognition event error:", event.error);
        if (event.error === "not-allowed") {
          setVoiceError("Microphone permission denied. Please allow microphone access in your browser to speak.");
        } else if (event.error === "no-speech") {
          setVoiceError("We could not hear your answer, please try again or type it.");
        } else if (event.error === "audio-capture") {
          setVoiceError("No microphone detected. Please connect a microphone or type your answer.");
        } else if (event.error === "network") {
          setVoiceError("Speech recognition network error. You can continue typing your answer.");
        } else {
          setVoiceError(`Voice input issue: ${event.error}. You can continue typing.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (!textBeforeSpeechRef.current.trim() && !answerText.trim()) {
          setVoiceError("We could not hear your answer, please try again or type it.");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      console.error("Failed to start speech recognition:", err);
      setVoiceError("Could not start microphone. Please check your browser settings or type your answer.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Adaptive interview HUD helpers
  const formatStageName = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'intro':
        return 'Stage 1/5: Introduction';
      case 'technical':
        return 'Stage 2/5: Technical Deep-Dive';
      case 'behavioral':
        return 'Stage 3/5: Behavioral & Leadership';
      case 'situational':
        return 'Stage 4/5: Situational & Problem Solving';
      case 'qa':
        return 'Stage 5/5: Candidate Q&A';
      default:
        return `Stage: ${stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : 'General'}`;
    }
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return { label: 'Difficulty: Easy', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300' };
      case 'hard':
        return { label: 'Difficulty: Hard', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300' };
      default:
        return { label: 'Difficulty: Medium', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300' };
    }
  };

  const getQuestionTypeBadge = (qType: string) => {
    switch (qType?.toLowerCase()) {
      case 'follow_up':
      case 'followup':
        return { label: 'Follow-up', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300' };
      case 'probe':
        return { label: 'In-Depth Probe', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300' };
      default:
        return { label: 'Main Question', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300' };
    }
  };

  // Handle Start Interview
  const handleStartInterview = async () => {
    const nameToUse = candidateName.trim() || "Candidate";
    setIsStarting(true);
    setError(null);
    setLlmUnavailable(false);

    try {
      if (urlRoomid && urlRoomid !== "demo-sandbox") {
        await interviewService.startSession(urlRoomid).catch((err) => console.warn("startSession note:", err));
      }

      const response = await interviewService.startInterview({
        candidate_name: nameToUse,
        candidate_email: candidateEmail.trim(),
        job_title: jobTitle.trim(),
        job_description: jobDescription.trim(),
        required_skills: candidateSkills,
        candidate_resume: candidateResume.trim(),
        target_duration_minutes: 30
      });

      if (response.success && response.data) {
        setInterviewId(response.data.interview_id);
        setCurrentStage(response.data.current_stage || "intro");
        const introMsg = response.data.introduction || response.data.question || "";
        setCurrentQuestion(introMsg);
        setQuestionNumber(1);
        if (response.data.total_questions) {
          setTotalQuestions(response.data.total_questions);
        } else if (response.data.plan?.target_questions) {
          setTotalQuestions(response.data.plan.target_questions);
        }
        setQuestionType("main");
        setLlmUnavailable(false);
        setInterviewStarted(true);

        // Record initial AI message in conversation history
        setConversationHistory([
          {
            role: 'ai',
            content: introMsg,
            stage: response.data.current_stage || 'intro',
            questionNumber: 1
          }
        ]);
      } else {
        const isLlmIssue = response.error?.code === 'LLM_UNAVAILABLE';
        setLlmUnavailable(isLlmIssue);
        setError(
          isLlmIssue
            ? "AI is temporarily unavailable, retrying..."
            : (response.message || response.error?.message || "Failed to start interview session.")
        );
      }
    } catch (err: unknown) {
      console.error("Error starting interview:", err);
      setLlmUnavailable(true);
      setError("AI is temporarily unavailable, retrying...");
    } finally {
      setIsStarting(false);
    }
  };

  // Handle Submit Answer
  const handleSubmitAnswer = async (isSkipped: boolean = false) => {
    if (isListening) {
      stopListening();
    }

    if (isSubmitting) return;

    const currentInput = answerText.trim() || lastSubmittedAnswer.trim();

    // Validation: Require min 10 chars unless explicitly skipped
    if (!isSkipped) {
      if (!currentInput) {
        setError("We could not hear your answer, please try again or type it.");
        return;
      }
      if (currentInput.length < 10) {
        setError("Your answer must be at least 10 characters, or click 'Skip Question'.");
        return;
      }
    }

    if (!interviewId) {
      setError("Interview session not initialized. Please restart.");
      return;
    }

    const submittedAnswer = isSkipped ? "Question skipped" : currentInput;
    setLastSubmittedAnswer(submittedAnswer);
    setIsSubmitting(true);
    setError(null);
    setLlmUnavailable(false);

    // 20-second safety timeout with retry prompt
    const timeoutTimer = setTimeout(() => {
      setIsSubmitting(false);
      setError("AI response took longer than 20 seconds. Please check your connection and click Retry.");
    }, 20000);

    // Optimistically add candidate response to history
    const updatedHistory: MessageItem[] = [
      ...conversationHistory,
      {
        role: 'candidate',
        content: submittedAnswer,
        stage: currentStage,
        questionNumber: questionNumber
      }
    ];
    setConversationHistory(updatedHistory);

    try {
      const response = await interviewService.submitAnswer({
        interview_id: interviewId,
        answer: submittedAnswer,
        is_skipped: isSkipped
      });

      clearTimeout(timeoutTimer);

      if (response.success && response.data) {
        const data = response.data;
        setLlmUnavailable(false);

        if (data.interview_complete || data.is_finished) {
          setInterviewComplete(true);
          setClosingMessage(data.closing_message || data.message || "Thank you, your interview is complete. The recruiter will contact you.");

          if (urlRoomid && urlRoomid !== "demo-sandbox") {
            interviewService.completeSession(urlRoomid).catch((err) => console.warn("completeSession note:", err));
          }

          // If recruiter view, fetch the compiled background report from database so real scores show up instead of 0/100
          if (!isCandidate && interviewId) {
            const fetchFinalReport = async (attempts = 5) => {
              try {
                const res = await fetch(`${FASTAPI_BASE_URL}/api/candidates/${interviewId}`, {
                  headers: { "X-User-Role": "RECRUITER" }
                });
                if (res.ok) {
                  const cdata = await res.json();
                  const payload = cdata.data || cdata;
                  const rep = payload.report || payload.candidate?.report;
                  const sc = payload.candidate?.score ?? rep?.scores?.overall;
                  if (rep && rep.scores) {
                    setInterviewReport(rep);
                    if (typeof sc === "number") {
                      setFinalScore(sc);
                    }
                    return;
                  }
                }
              } catch (e) {
                console.warn("Could not fetch recruiter final report:", e);
              }
              if (attempts > 0) {
                setTimeout(() => fetchFinalReport(attempts - 1), 1200);
              }
            };
            setTimeout(() => fetchFinalReport(), 800);
          }

          // Persist completed candidate event to localStorage for dashboard synchronization
          try {
            const candName = candidateName.trim() || "Candidate";
            const roleName = jobTitle.trim() || "Full Stack Developer";
            const completedRecord = {
              id: interviewId || `cand-${Date.now()}`,
              name: candName,
              email: candidateEmail.trim() || "candidate@example.com",
              role: roleName,
              status: "Completed",
              completedAt: "Just now",
              skills: candidateSkills.length > 0 ? candidateSkills : ["Full Stack", "Problem Solving"],
              avatarBg: "bg-[var(--primary-soft)] text-[var(--primary)]",
              initials: candName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || "CD",
              resumeText: `Completed AI Video Interview for ${roleName}. Submitted to recruiting team.`
            };
            const existing = JSON.parse(localStorage.getItem("ai_interview_candidates_v3") || localStorage.getItem("ai_interview_candidates") || "[]");
            const updated = [completedRecord, ...existing.filter((c: { name?: string }) => c.name !== completedRecord.name)];
            localStorage.setItem("ai_interview_candidates_v3", JSON.stringify(updated));
            localStorage.setItem("ai_interview_candidates", JSON.stringify(updated));
            window.dispatchEvent(new Event("interview-completed"));
          } catch (e) {
            console.warn("Could not save completed candidate to localStorage:", e);
          }
        } else {
          // Advance to next question
          const nextQ = data.question || data.next_question || "";
          const nextStage = data.current_stage || currentStage;
          const nextNum = data.question_number || questionNumber + 1;
          const totalQ = data.total_questions || totalQuestions;

          setCurrentQuestion(nextQ);
          setCurrentStage(nextStage);
          setQuestionNumber(nextNum);
          if (data.total_questions) setTotalQuestions(data.total_questions);
          setAnswerText("");

          // Add AI next question to history
          if (nextQ) {
            setConversationHistory([
              ...updatedHistory,
              {
                role: 'ai',
                content: nextQ,
                stage: nextStage,
                questionNumber: nextNum
              }
            ]);

            // Speak question via TTS
            if (ttsSupported) {
              speakQuestion(nextQ);
            }
          }
        }
      } else {
        const isLlmIssue = response.error?.code === 'LLM_UNAVAILABLE';
        setLlmUnavailable(isLlmIssue);
        setError(
          isLlmIssue
            ? "AI is temporarily unavailable, please retry"
            : (response.error?.message || response.message || "Failed to process candidate answer.")
        );
      }
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      console.error("Error submitting answer:", err);
      setLlmUnavailable(true);
      setError("AI is temporarily unavailable, please retry");
    } finally {
      clearTimeout(timeoutTimer);
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    setInterviewStarted(false);
    setInterviewId("");
    setCurrentStage("intro");
    setCurrentQuestion("");
    setCurrentDifficulty("medium");
    setCurrentTopic("Introduction");
    setQuestionType("main");
    setLlmUnavailable(false);
    setLastSubmittedAnswer("");
    setQuestionNumber(0);
    setAnswerText("");
    setLastEvaluation(null);
    setConversationHistory([]);
    setInterviewComplete(false);
    setClosingMessage("");
    setFinalScore(0);
    setError(null);
  };

  // Plain /interview with no token: Show link input, active scheduled invites, and instant practice demo option
  if (!urlRoomid) {
    const storedInvites = (() => {
      try {
        const raw = localStorage.getItem("ai_interview_invitations");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Object.values(parsed) as Array<{
          token: string;
          candidate_name?: string;
          candidate_email?: string;
          job_role?: string;
          expires_at_timestamp?: number;
          is_used?: boolean;
        }>;
      } catch {
        return [];
      }
    })();

    const activeInvite = storedInvites.find(
      (inv) => (!inv.expires_at_timestamp || inv.expires_at_timestamp > Date.now()) && !inv.is_used
    );

    return (
      <InterviewLayout isDemo={false} maxWidthClass="max-w-lg">
        <div className="flex-1 flex flex-col items-center justify-center w-full py-12">
          <Card className="w-full shadow-xl border-slate-200 bg-white text-center p-6 sm:p-8 space-y-6 rounded-2xl">
            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-md text-white">
              <Bot className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-slate-900">
                AI Technical Interview Portal
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Ready to begin your assessment? Join with your recruiter invitation link or start an interactive practice interview.
              </p>
            </div>

            {/* Found Scheduled Invite Banner */}
            {activeInvite && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Scheduled Assessment Ready</span>
                  <span className="text-xs font-bold text-slate-900">{activeInvite.job_role || "Technical Assessment"}</span>
                  <span className="text-[11px] text-slate-600">Candidate: {activeInvite.candidate_name || "You"}</span>
                </div>
                <Button
                  onClick={() => navigate(`/interview/${activeInvite.token}`)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-4 rounded-lg shadow-xs"
                >
                  Join My Interview →
                </Button>
              </div>
            )}

            {/* Token / URL Input Box */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-left">
              <label className="text-xs font-semibold text-slate-700 block">
                Have an invitation link or token?
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Paste URL or invitation code..."
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinFromInput()}
                  className="text-xs h-9 bg-white"
                />
                <Button
                  type="button"
                  onClick={handleJoinFromInput}
                  disabled={!inputToken.trim()}
                  className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs h-9 shrink-0 px-4 disabled:opacity-50"
                >
                  Enter
                </Button>
              </div>
            </div>

            {/* Direct Start Action */}
            <div className="space-y-2.5 pt-1">
              <Button
                onClick={() => navigate("/interview/demo-sandbox", { state: { isDemo: true } })}
                className="w-full h-10 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Practice Interview (Demo)</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full text-xs text-slate-500 hover:text-slate-700 border-slate-200 h-9"
              >
                Return to Home
              </Button>
            </div>
          </Card>
        </div>
      </InterviewLayout>
    );
  }

  // Validating Token loading screen
  if (!isDemo && tokenValidationState.status === "validating") {
    return (
      <InterviewLayout isDemo={false} maxWidthClass="max-w-md">
        <div className="flex-1 flex flex-col items-center justify-center w-full py-20 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)] mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Verifying Interview Invitation...</h2>
          <p className="text-xs text-slate-500">Authenticating single-use access token with backend</p>
        </div>
      </InterviewLayout>
    );
  }

  // Requirement 4: Invalid, expired, cancelled, or used links
  if (!isDemo && tokenValidationState.status === "invalid") {
    const reason = tokenValidationState.reason;
    return (
      <InterviewLayout isDemo={false} maxWidthClass="max-w-md">
        <div className="flex-1 flex flex-col items-center justify-center w-full py-16">
          <Card className="w-full shadow-lg border-slate-200 bg-white text-center p-8 space-y-5 rounded-2xl">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center border border-red-200 text-red-600 shadow-xs">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900">
                {reason === "expired"
                  ? "Invitation Link Expired"
                  : reason === "completed"
                  ? "Interview Already Completed"
                  : reason === "cancelled"
                  ? "Invitation Cancelled"
                  : "Invalid Interview Link"}
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                {tokenValidationState.message ||
                  "This interview link cannot be used. Please reach out to your recruiter for an updated invitation."}
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={() => navigate("/")} className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs">
                Return to Home
              </Button>
            </div>
          </Card>
        </div>
      </InterviewLayout>
    );
  }

  // 1. SETUP VIEW (Before interview starts: Device check + Read-only Info + Consent)
  if (!interviewStarted) {
    return (
      <InterviewLayout
        candidateName={candidateName}
        isRecruiter={false}
        isDemo={isDemo}
        onLogout={handleCandidateLogout}
        maxWidthClass="max-w-2xl"
      >
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <Card className="w-full max-w-xl shadow-lg border-slate-200 bg-white">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-md mb-3">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                {isDemo ? "AI Interview Sandbox (Demo)" : "Candidate Assessment Verification"}
              </CardTitle>
              <CardDescription className="text-slate-500">
                {isDemo ? "Recruiter test room (excluded from candidate records & KPIs)" : "Please verify your audio/video and provide consent before beginning."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Connection Issue</p>
                    <p className="text-xs mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Read-Only Candidate Information Card (Requirement 4) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-600" /> Candidate Name
                  </span>
                  <span className="font-bold text-slate-800">{candidateName || "Candidate"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-600" /> Candidate Email
                  </span>
                  <span className="font-mono text-slate-800">{candidateEmail || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-cyan-600" /> Target Job Role
                  </span>
                  <span className="font-bold text-cyan-700">{jobTitle || "Full Stack Developer"}</span>
                </div>
                {jobDescription && (
                  <div className="py-1">
                    <span className="text-slate-500 font-semibold block mb-0.5">Role Focus / Description:</span>
                    <p className="text-slate-700 leading-relaxed italic bg-white p-2 rounded border border-slate-200/60">
                      {jobDescription}
                    </p>
                  </div>
                )}
                {candidateSkills.length > 0 && (
                  <div className="pt-1">
                    <span className="text-slate-500 font-semibold block mb-1">Key Focus Skills:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {candidateSkills.map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[11px] px-2 py-0.5 bg-white border border-slate-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Requirement 4: Device Check (Camera & Microphone) */}
              <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-100 space-y-3">
                <span className="text-xs font-bold text-sky-950 uppercase tracking-wider block">
                  Hardware & Device Verification
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Camera Check */}
                  <div className="p-3 bg-white rounded-lg border border-sky-100 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-sky-600" /> Camera
                      </span>
                      {cameraStatus === 'active' ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Ready ✓
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500">Unchecked</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        startCamera();
                        setCameraChecked(true);
                      }}
                      className="text-xs h-8 border-sky-200 text-sky-800 hover:bg-sky-50"
                    >
                      {cameraStatus === 'active' ? "Camera Verified ✓" : "Test Camera"}
                    </Button>
                  </div>

                  {/* Microphone Check */}
                  <div className="p-3 bg-white rounded-lg border border-sky-100 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-sky-600" /> Microphone
                      </span>
                      {micChecked ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Ready ✓
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500">Unchecked</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMicChecked(true);
                        toggleListening();
                      }}
                      className="text-xs h-8 border-sky-200 text-sky-800 hover:bg-sky-50"
                    >
                      {micChecked ? "Microphone Verified ✓" : "Test Microphone"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Requirement 4: Consent Checkbox */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="candidate-consent"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                />
                <label htmlFor="candidate-consent" className="text-xs text-slate-700 leading-relaxed cursor-pointer select-none">
                  <strong className="text-slate-900 block font-semibold mb-0.5">Assessment Consent & Integrity Pledge</strong>
                  I confirm that I am <strong className="text-slate-900">{candidateName || "the candidate"}</strong>. I consent to an AI-assisted video and audio assessment and agree to answer all questions independently without unauthorized assistance.
                </label>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleStartInterview}
                  disabled={isStarting || !consentChecked}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium py-2.5 rounded-lg shadow transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing AI Interviewer...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Begin AI Interview
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
                {!consentChecked && (
                  <p className="text-[11px] text-center text-slate-400 mt-1.5">
                    Please review and check the consent box above to begin.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </InterviewLayout>
    );
  }

  // 2. COMPLETION VIEW (Requirement 8: Candidate-facing responses never include scores or evaluation)
  if (interviewComplete) {
    if (!isDemo) {
      return (
        <InterviewLayout
          candidateName={candidateName}
          isRecruiter={false}
          isDemo={false}
          maxWidthClass="max-w-2xl"
        >
          <div className="w-full py-12 flex justify-center">
            <Card className="w-full bg-white shadow-xl border border-slate-200 rounded-2xl overflow-hidden text-center p-8 sm:p-10 space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Interview Submitted Successfully
                </h1>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong className="text-slate-800">{candidateName || "Candidate"}</strong>! Your interview responses have been securely delivered to the recruiting team.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-left space-y-3 max-w-md mx-auto text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Position</span>
                  <span className="font-semibold text-slate-800">{jobTitle || "Engineering Role"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Candidate Email</span>
                  <span className="font-semibold text-slate-800">{candidateEmail}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Submission Timestamp</span>
                  <span className="font-semibold text-slate-800">{new Date().toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-medium">Single-Use Link Status</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono font-bold text-[11px]">
                    Closed & Locked
                  </span>
                </div>
              </div>

              <div className="p-4 bg-sky-50 rounded-xl border border-sky-100 text-xs text-sky-900 max-w-md mx-auto leading-relaxed">
                The recruiting team will review your complete interview and contact you regarding next steps in the hiring process.
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto px-8 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium py-2.5 rounded-lg shadow-sm"
                >
                  Return to Home
                </Button>
              </div>
            </Card>
          </div>
        </InterviewLayout>
      );
    }
    return (
      <InterviewLayout
        candidateName={candidateName || loggedInName}
        isRecruiter={!isCandidate}
        onLogout={handleCandidateLogout}
        maxWidthClass="max-w-5xl"
      >
        <div className="w-full space-y-6">
          {/* Top Report Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shrink-0">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold uppercase tracking-wide">
                      Status: Completed
                    </span>
                    {isAudioTextMode || cameraStatus === 'off' || cameraStatus === 'denied' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1">
                        <CameraOff className="w-3 h-3 text-slate-500" />
                        Camera Off (Audio/Text Mode)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                        <Camera className="w-3 h-3 text-emerald-600" />
                        Camera Active
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold uppercase tracking-wide ${
                      (interviewReport?.recommendation || "").toLowerCase().includes("not recommended") || finalScore < 40
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : (interviewReport?.recommendation || "").toLowerCase().includes("needs improvement") || (finalScore >= 40 && finalScore < 60)
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : (interviewReport?.recommendation || "").toLowerCase().includes("under consideration") || (finalScore >= 60 && finalScore < 80)
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {interviewReport?.recommendation || (finalScore >= 80 ? "Recommended" : (finalScore >= 60 ? "Under Consideration" : (finalScore >= 40 ? "Needs Improvement" : "Not Recommended")))}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
                    Candidate Evaluation Report
                  </h1>
                  <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                    AI-assessed interview session for <strong className="text-[var(--text)]">{candidateName || "Candidate"}</strong> ({jobTitle || "Full Stack Developer"})
                  </p>
                  <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] pt-1 flex-wrap">
                    <span>📅 Date: <strong className="text-[var(--text)]">{interviewReport?.interview_date || new Date().toLocaleDateString()}</strong></span>
                    <span>⏱️ Duration: <strong className="text-[var(--text)]">{interviewReport?.duration_minutes || 15} mins</strong></span>
                    <span>❓ Questions Evaluated: <strong className="text-[var(--text)]">{interviewReport?.total_questions || 10} / 10</strong></span>
                  </div>
                </div>
              </div>

              {/* Big Score Card */}
              <div className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl border min-w-[160px] text-center shadow-inner ${
                (interviewReport?.recommendation || "").toLowerCase().includes("not recommended") || finalScore < 40
                  ? "bg-gradient-to-br from-rose-50 to-red-50 border-rose-200 text-rose-800"
                  : (interviewReport?.recommendation || "").toLowerCase().includes("needs improvement") || (finalScore >= 40 && finalScore < 60)
                  ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-800"
                  : (interviewReport?.recommendation || "").toLowerCase().includes("under consideration") || (finalScore >= 60 && finalScore < 80)
                  ? "bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 text-sky-800"
                  : "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/80 text-emerald-800"
              }`}>
                <span className="text-xs uppercase tracking-wider font-bold">Overall Score</span>
                <div className={`text-4xl sm:text-5xl font-black tracking-tight my-1 ${
                  (interviewReport?.recommendation || "").toLowerCase().includes("not recommended") || finalScore < 40
                    ? "text-rose-700"
                    : (interviewReport?.recommendation || "").toLowerCase().includes("needs improvement") || (finalScore >= 40 && finalScore < 60)
                    ? "text-amber-700"
                    : (interviewReport?.recommendation || "").toLowerCase().includes("under consideration") || (finalScore >= 60 && finalScore < 80)
                    ? "text-sky-700"
                    : "text-emerald-700"
                }`}>
                  {finalScore.toFixed(0)}
                  <span className="text-lg font-medium opacity-70">/100</span>
                </div>
                <span className="text-[11px] font-semibold opacity-90">
                  {interviewReport?.recommendation || (finalScore >= 80 ? "Recommended" : (finalScore >= 60 ? "Under Consideration" : (finalScore >= 40 ? "Needs Improvement" : "Not Recommended")))}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[var(--border)] shadow-sm print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Report Actions:</span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  className="text-xs font-semibold flex items-center gap-1.5 border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download / Print PDF</span>
                </Button>
                <Button
                  onClick={() => navigate('/reports')}
                  className="text-xs font-semibold flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View in Recruiter Reports</span>
                </Button>
                <Button
                  onClick={handleRestart}
                  variant="ghost"
                  className="text-xs font-semibold flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start New Interview</span>
                </Button>
              </div>
            </div>

            {/* Competency Scorecard Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-xl border border-[var(--border)] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Technical Depth</span>
                  <span className="font-mono font-bold text-[var(--text)]">{interviewReport?.scores?.technical ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${interviewReport?.scores?.technical ?? 0}%` }} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-2">Syntax, architecture, problem-solving depth</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[var(--border)] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Problem Solving</span>
                  <span className="font-mono font-bold text-[var(--text)]">{interviewReport?.scores?.problem_solving ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${interviewReport?.scores?.problem_solving ?? 0}%` }} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-2">Logical structuring and system trade-offs</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[var(--border)] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Communication</span>
                  <span className="font-mono font-bold text-[var(--text)]">{interviewReport?.scores?.communication ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${interviewReport?.scores?.communication ?? 0}%` }} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-2">Clarity, articulation, and concise delivery</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[var(--border)] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Role & Culture Fit</span>
                  <span className="font-mono font-bold text-[var(--text)]">{interviewReport?.scores?.cultural_fit ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${interviewReport?.scores?.cultural_fit ?? 0}%` }} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-2">Collaboration, STAR responses, ownership</p>
              </div>
            </div>

            {/* Executive AI Summary & Closing Remarks */}
            <div className="p-6 bg-white rounded-2xl border border-[var(--border)] shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Executive AI Evaluation Summary</span>
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {interviewReport?.summary || closingMessage || "Candidate completed the interview evaluation."}
              </p>
              {closingMessage && closingMessage !== interviewReport?.summary && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700">
                  <strong className="text-slate-900 block mb-0.5">Closing Remarks from AI Interviewer:</strong>
                  {closingMessage}
                </div>
              )}
            </div>

            {/* Strengths and Growth Areas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-white rounded-2xl border border-emerald-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>Key Strengths Identified</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700">
                  {(interviewReport?.key_strengths && interviewReport.key_strengths.length > 0) ? (
                    interviewReport.key_strengths.map((strength: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{strength}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic py-1">No notable strengths identified based on candidate responses.</li>
                  )}
                </ul>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-amber-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  <span>Growth & Improvement Areas</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700">
                  {(interviewReport?.areas_for_improvement && interviewReport.areas_for_improvement.length > 0) ? (
                    interviewReport.areas_for_improvement.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold">→</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic py-1">Standard engineering best practices.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Question-by-Question Transcript & AI Assessment */}
            <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[var(--text)] tracking-tight">Question-by-Question Transcript & Evaluation</h3>
                  <p className="text-xs text-[var(--text-muted)]">Complete audit trail of all 10 bounded interview questions and responses.</p>
                </div>
                <span className="px-2.5 py-1 rounded bg-[var(--surface-alt)] text-[var(--primary)] font-mono text-xs font-bold">
                  {interviewReport?.questions_summary?.length || conversationHistory.filter(m => m.role === 'candidate').length || 10} Questions
                </span>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {interviewReport?.questions_summary && interviewReport.questions_summary.length > 0 ? (
                  interviewReport.questions_summary.map((qItem, idx) => (
                    <div key={idx} className="p-5 space-y-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                            Q{qItem.question_number}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                            {qItem.stage}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="text-[var(--text-muted)]">Score:</span>
                          <span className="font-bold text-emerald-700 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                            {qItem.score}/10
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-900">
                          {qItem.question}
                        </p>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-700 leading-relaxed italic">
                          "{qItem.answer || "No response recorded."}"
                        </div>
                      </div>

                      {qItem.feedback && (
                        <p className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                          <span className="font-bold">AI Feedback:</span> {qItem.feedback}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  conversationHistory.filter(m => m.role === 'candidate').map((msg, idx) => (
                    <div key={idx} className="p-5 space-y-2 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                          Question #{idx + 1}
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Recorded
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 italic bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                        "{msg.content}"
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Final Controls */}
            <div className="flex items-center justify-end gap-3 pt-2 print:hidden">
              <Button
                onClick={() => navigate('/reports')}
                variant="outline"
                className="text-xs font-semibold"
              >
                Go to Recruiter Dashboard
              </Button>
              <Button
                onClick={handleRestart}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Conduct Another Interview
              </Button>
            </div>

          </div>
      </InterviewLayout>
    );
  }

  // 3. ACTIVE INTERVIEW ROOM VIEW
  return (
    <InterviewLayout
      candidateName={candidateName || loggedInName}
      isRecruiter={!isCandidate}
      onLogout={handleCandidateLogout}
      maxWidthClass="max-w-6xl"
    >
      <div className="w-full space-y-6">
        
        {/* Top Meeting Header & Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  AI Interview Room
                </h1>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Candidate: <span className="font-medium text-slate-700 dark:text-slate-300">{candidateName || "Candidate"}</span> • Role: <span className="font-medium text-slate-700 dark:text-slate-300">{jobTitle || "Candidate"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="uppercase font-semibold tracking-wider text-xs px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
              Stage: {currentStage}
            </Badge>
            <Badge variant="secondary" className="text-xs px-2.5 py-1">
              {questionNumber === 0 ? "Introduction" : `Question #${questionNumber}`}
            </Badge>
            <button
              onClick={() => navigate(isCandidate ? '/' : '/dashboard')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Exit Interview Room"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Two Main Video-Call Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
          
          {/* LEFT: AI Interviewer Panel (Camera Off Video-Call Participant) */}
          <div className="relative bg-slate-950 rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col items-center justify-center min-h-[280px] sm:min-h-[320px] aspect-video">
            {/* Background ambient gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-950 to-slate-950 pointer-events-none" />

            {/* Centered AI Avatar with speaking visualizer */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                {isSpeaking && (
                  <>
                    <span className="absolute -inset-4 rounded-full bg-cyan-500/20 animate-ping" />
                    <span className="absolute -inset-2 rounded-full border-2 border-cyan-400/60 animate-pulse" />
                    <span className="absolute -inset-6 rounded-full border border-cyan-400/25 animate-pulse" />
                  </>
                )}
                <div
                  className={`w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-2xl transition-all duration-300 ${
                    isSpeaking
                      ? "ring-4 ring-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.45)] scale-105"
                      : "border-2 border-slate-700"
                  }`}
                >
                  <Bot className="w-12 h-12 text-white" />
                </div>
              </div>

              {/* AI Interviewer Name */}
              <p className="mt-3.5 text-sm font-semibold text-slate-200">
                AI Interviewer
              </p>

              {/* Speaking Visual / Audio Equalizer Indicator */}
              {isSpeaking ? (
                <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-medium animate-pulse shadow-sm">
                  <span className="flex items-center gap-0.5 h-3 mr-0.5">
                    <span className="w-1 bg-cyan-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2"></span>
                    <span className="w-1 bg-cyan-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-3.5"></span>
                    <span className="w-1 bg-cyan-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2"></span>
                    <span className="w-1 bg-cyan-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-3"></span>
                  </span>
                  AI is speaking...
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-slate-800/70 border border-slate-700/50 text-slate-400 text-xs">
                  <Volume2 className="w-3 h-3 text-slate-500" />
                  <span>Ready</span>
                </div>
              )}
            </div>

            {/* Video-Call Name Tag Overlay (Bottom Left) */}
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-white text-xs">
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium">AI Interviewer</span>
              {isSpeaking && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
              )}
            </div>

            {/* Stage Indicator Overlay (Top Left) */}
            <div className="absolute top-3 left-3 z-20">
              <span className="bg-black/50 backdrop-blur-sm text-slate-300 text-[11px] px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider">
                {currentStage}
              </span>
            </div>
          </div>

          {/* RIGHT: Candidate Webcam Panel */}
          <div className="relative bg-slate-950 rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col items-center justify-center min-h-[280px] sm:min-h-[320px] aspect-video">
            {/* Live Video Element - always mounted for ref stability */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                cameraStatus === 'active' ? 'block' : 'hidden'
              }`}
            />

            {/* Camera Off / Placeholder when video is inactive */}
            {cameraStatus !== 'active' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 z-10 bg-slate-950">
                {cameraStatus === 'idle' && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg">
                      <Camera className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-slate-400 text-sm">Initializing camera...</p>
                  </>
                )}
                {cameraStatus === 'requesting' && (
                  <>
                    <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                    <p className="text-slate-400 text-sm">Requesting camera permission...</p>
                  </>
                )}
                {cameraStatus === 'off' && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center shadow-lg text-white text-lg font-bold">
                      {candidateName ? candidateName.slice(0, 2).toUpperCase() : <User className="w-7 h-7 text-slate-400" />}
                    </div>
                    <div>
                      <p className="text-slate-300 text-sm font-medium">
                        {isAudioTextMode ? "Audio/Text Mode (Camera Off)" : "Camera is turned off"}
                      </p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 mt-1 inline-block"
                      >
                        Turn camera on
                      </button>
                    </div>
                  </>
                )}
                {cameraStatus === 'denied' && (
                  <div className="flex flex-col items-center justify-center p-3 text-center max-w-sm space-y-2">
                    <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-amber-400 text-xs font-bold">Camera Permission Denied</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Your browser has blocked camera access for this session.
                      </p>
                    </div>
                    {/* Clear step-by-step instructions */}
                    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-left space-y-1 text-[11px] text-slate-300">
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-cyan-400 shrink-0">1.</span>
                        <span>Click the <strong>lock icon 🔒</strong> in your browser address bar.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-cyan-400 shrink-0">2.</span>
                        <span>Allow <strong>Camera</strong> and <strong>Microphone</strong> permissions.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-cyan-400 shrink-0">3.</span>
                        <span>Click <strong>Try Again</strong> below or reload this page.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center pt-0.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={startCamera}
                        className="text-xs h-7 px-2.5 bg-cyan-600 hover:bg-cyan-700 text-white"
                      >
                        <RotateCw className="w-3 h-3 mr-1" />
                        Try Again
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCameraStatus('off');
                          setIsAudioTextMode(true);
                        }}
                        className="text-xs h-7 px-2.5 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        <CameraOff className="w-3 h-3 mr-1" />
                        Continue without camera
                      </Button>
                    </div>
                  </div>
                )}
                {cameraStatus === 'unavailable' && (
                  <div className="flex flex-col items-center justify-center p-3 text-center max-w-sm space-y-2">
                    <VideoOff className="w-8 h-8 text-slate-500" />
                    <div>
                      <p className="text-slate-300 text-xs font-semibold">Camera Unavailable</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">{cameraError || "No video input device detected."}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCameraStatus('off');
                        setIsAudioTextMode(true);
                      }}
                      className="text-xs h-7 px-2.5 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      <CameraOff className="w-3 h-3 mr-1" />
                      Continue in Audio/Text Mode
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* LIVE Badge (Top Right) */}
            {cameraStatus === 'active' && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-red-500/30">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
                  LIVE
                </span>
              </div>
            )}

            {/* Video-Call Name Tag Overlay (Bottom Left) */}
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-white text-xs">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium">{candidateName || "Candidate"} (You)</span>
              {isListening ? (
                <span className="flex items-center gap-1 text-red-400 ml-1">
                  <Mic className="w-3 h-3 animate-pulse" />
                  <span className="text-[10px]">Mic Active</span>
                </span>
              ) : (
                <MicOff className="w-3 h-3 text-slate-400 ml-1" />
              )}
            </div>

            {/* Camera Toggle Button (Bottom Right) */}
            <div className="absolute bottom-3 right-3 z-20">
              <Button
                id="camera-toggle-btn"
                type="button"
                size="sm"
                variant="outline"
                onClick={cameraStatus === 'active' ? stopCamera : startCamera}
                disabled={cameraStatus === 'requesting'}
                className={`text-xs h-7 px-2.5 flex items-center gap-1.5 backdrop-blur-md transition-all shadow ${
                  cameraStatus === 'active'
                    ? 'bg-black/60 border-red-500/50 text-red-400 hover:bg-red-950/60'
                    : 'bg-black/60 border-white/20 text-slate-200 hover:bg-white/10'
                }`}
              >
                {cameraStatus === 'requesting' ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /><span>Requesting...</span></>
                ) : cameraStatus === 'active' ? (
                  <><VideoOff className="w-3 h-3 text-red-400" /><span>Turn Off Camera</span></>
                ) : (
                  <><Video className="w-3 h-3 text-cyan-400" /><span>Turn On Camera</span></>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Error / AI Temporary Unavailable Notification with Retry */}
        {error && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-sm shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-sm">
                  {llmUnavailable ? "AI is temporarily unavailable, please retry" : "Operation Notice"}
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(lastSubmittedAnswer || answerText) && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (!answerText && lastSubmittedAnswer) {
                      setAnswerText(lastSubmittedAnswer);
                    }
                    handleSubmitAnswer();
                  }}
                  disabled={isSubmitting}
                  className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm flex items-center gap-1.5"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
                  Retry Question
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setError(null)}
                className="text-xs hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-200"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Current Active Question Card (Below Video Panels) */}
        <Card className="shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 py-3 px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  AI Interviewer Question {questionNumber > 0 ? `• #${questionNumber}` : "• Introduction"}
                </span>
              </div>

              {/* TTS Controls */}
              {ttsSupported ? (
                <div className="flex items-center gap-2">
                  {isSpeaking ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-cyan-700 dark:text-cyan-300 font-medium">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Speaking...</span>
                      </div>
                      <Button
                        id="tts-stop-btn"
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={stopSpeaking}
                        className="text-xs h-7 px-2.5 flex items-center gap-1 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-600"
                      >
                        <VolumeX className="w-3 h-3" />
                        Stop Speaking
                      </Button>
                    </>
                  ) : (
                    currentQuestion && (
                      <Button
                        id="tts-replay-btn"
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => speakQuestion(currentQuestion)}
                        className="text-xs h-7 px-2.5 flex items-center gap-1 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-600"
                      >
                        <RotateCw className="w-3 h-3" />
                        Replay Question
                      </Button>
                    )
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  (Browser TTS unavailable)
                </span>
              )}
            </div>
          </CardHeader>

          {/* Progress & Stage Indicators */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 text-xs">
            {/* Stage Pill */}
            <span className="px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 font-medium border border-cyan-200 dark:border-cyan-800">
              {formatStageName(currentStage)}
            </span>

            {/* Progress Pill */}
            <span className="px-2.5 py-1 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium">
              Question {questionNumber} of ~{totalQuestions}
            </span>
          </div>

          <CardContent className="p-6">
            <blockquote className="text-slate-900 dark:text-slate-100 text-base sm:text-lg leading-relaxed whitespace-pre-line font-normal border-l-4 border-cyan-500 pl-4">
              "{currentQuestion || "Preparing interview question..."}"
            </blockquote>
          </CardContent>
        </Card>

        {/* Candidate Response Textarea Card */}
        <Card className="shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2 pt-4 px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-600" /> Your Answer
              </label>

              <div className="flex items-center gap-2">
                {/* Voice Control Button */}
                {voiceSupported ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={isListening ? "destructive" : "outline"}
                    onClick={toggleListening}
                    disabled={isSubmitting}
                    id="speak-answer-btn"
                    className={`text-xs h-8 px-3 flex items-center gap-1.5 transition-all ${
                      isListening
                        ? "bg-red-600 hover:bg-red-700 text-white animate-pulse shadow-md"
                        : "border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-slate-700 dark:text-slate-200 hover:text-cyan-600"
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Stop Listening</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        <span>Speak Answer</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">
                    (Voice input unsupported)
                  </span>
                )}

                <span className="text-xs text-slate-400">
                  {answerText.length} characters
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            {/* Listening Live Status Banner */}
            {isListening && (
              <div id="listening-banner" className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-center justify-between gap-3 text-red-700 dark:text-red-300 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span className="font-medium">
                    Listening... Speak your answer. Recognized text is inserted below in real time.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={stopListening}
                  className="h-6 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                >
                  Done Speaking
                </Button>
              </div>
            )}

            {/* Voice Error Banner */}
            {voiceError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-2 text-amber-800 dark:text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{voiceError}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setVoiceError(null)}
                  className="h-6 px-1.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                >
                  Dismiss
                </Button>
              </div>
            )}

            <Textarea
              id="candidate-answer-textarea"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              readOnly={isSubmitting}
              placeholder={
                isListening
                  ? "Listening to your voice... (you can also edit this text anytime)"
                  : questionNumber === 1
                  ? "Respond to the interviewer (type or click 'Speak Answer' to speak)..."
                  : "Type your detailed answer or click 'Speak Answer' to speak. (Min 10 characters)..."
              }
              rows={5}
              className={`resize-y min-h-[120px] text-sm focus-visible:ring-cyan-500 font-normal leading-relaxed ${
                isListening ? "border-red-400 dark:border-red-600 ring-1 ring-red-400" : ""
              } ${isSubmitting ? "bg-slate-50/70 dark:bg-slate-800/40 cursor-wait opacity-90" : ""}`}
            />

            {/* AI Thinking and Typing Animation */}
            {isSubmitting && (
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50/80 dark:bg-cyan-950/50 p-2.5 rounded-lg border border-cyan-200/80 dark:border-cyan-800 animate-in fade-in duration-150">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600 dark:text-cyan-400" />
                <span>AI is thinking</span>
                <span className="flex space-x-1 items-center ml-1">
                  <span className="h-1.5 w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full animate-bounce"></span>
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Button
                  id="skip-question-btn"
                  type="button"
                  variant="outline"
                  onClick={() => handleSubmitAnswer(true)}
                  disabled={isSubmitting}
                  className="text-xs h-9 px-3.5 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Skip Question
                </Button>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Min 10 characters or click Skip Question
                </p>
              </div>

              <Button
                id="submit-answer-btn"
                onClick={() => handleSubmitAnswer(false)}
                disabled={isSubmitting || answerText.trim().length < 10}
                className="w-full sm:w-auto ml-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium px-6 py-2.5 rounded-lg shadow flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI is thinking...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Answer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </InterviewLayout>
  );
};

export default VideoInterview;