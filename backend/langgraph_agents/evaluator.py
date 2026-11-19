import re
from typing import Dict, Any, List, Tuple

class SemanticAnswerEvaluator:
    """
    Evaluates candidate answers across technical, behavioral, situational, and QA questions.
    Provides strict, honest, and objective scoring (0-10) with evidence-based feedback.
    """
    
    COMMON_SKIP_WORDS = {
        "skip", "skipped", "pass", "idk", "i don't know", "i dont know",
        "no idea", "next", "na", "n/a", "none", "nothing", "no", 
        "cant answer", "can't answer", "dont know", "not sure", "no answer",
        "i have no idea", "pass question", "skip question"
    }
    
    KEYBOARD_MASH_PATTERNS = [
        "asdf", "fdsa", "qwerty", "ytrewq", "zxcv", "vcxz", "hjkl", "lkjh",
        "12345", "67890", "qazwsx", "edcrfv", "tgbyhn", "ujmik"
    ]
    
    STOP_WORDS = {
        "what", "how", "why", "when", "where", "who", "which", "could", "would", 
        "should", "can", "you", "your", "tell", "about", "time", "faced", "walk", 
        "through", "experience", "describe", "situation", "explain", "with", "this", 
        "that", "these", "those", "have", "from", "into", "during", "before", "after", 
        "above", "below", "to", "of", "in", "for", "on", "by", "against", "between", 
        "over", "under", "again", "further", "then", "once", "here", "there", "all", 
        "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", 
        "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", 
        "will", "just", "the", "a", "an", "is", "are", "was", "were", "be", "been", 
        "being", "has", "had", "do", "does", "did", "doing", "and", "but", "if", 
        "or", "because", "as", "until", "while", "at", "please", "share", "more", "hands-on"
    }
    
    TECHNICAL_TERMS = {
        "react", "node", "nodejs", "javascript", "typescript", "python", "fastapi", 
        "sql", "nosql", "database", "databases", "mongodb", "postgres", "postgresql", 
        "query", "queries", "index", "indexes", "indexing", "api", "apis", "rest", 
        "graphql", "state", "redux", "zustand", "context", "hook", "hooks", 
        "component", "components", "lifecycle", "render", "rendering", "dom", 
        "virtual dom", "props", "async", "await", "promise", "concurrency", 
        "thread", "threads", "cache", "caching", "redis", "memcached", "security", 
        "jwt", "oauth", "sanitize", "cors", "csrf", "xss", "sql injection", 
        "scale", "scaling", "scalable", "latency", "throughput", "testing", 
        "unit test", "integration", "jest", "pytest", "docker", "kubernetes", 
        "cloud", "aws", "gcp", "azure", "ci/cd", "pipeline", "git", "commit", 
        "branch", "merge", "microservice", "microservices", "architecture", 
        "load balancer", "nginx", "http", "https", "websocket", "queue", "rabbitmq", "kafka"
    }
    
    BEHAVIORAL_TERMS = {
        "team", "member", "conflict", "disagreement", "resolved", "perspective", 
        "compromise", "consensus", "communication", "listened", "adapt", "adapted", 
        "adaptation", "deadline", "deadlines", "priority", "prioritize", "priorities", 
        "bug", "outage", "incident", "production", "postmortem", "learning", 
        "ownership", "collaboration", "empathy", "stakeholder", "stakeholders", 
        "client", "leadership", "responsibility", "feedback", "adapted", "pivoted"
    }
    
    SITUATIONAL_TERMS = {
        "migrate", "migration", "legacy", "downtime", "zero downtime", "architecture", 
        "dual write", "replication", "sync", "canary", "blue green", "deploy", 
        "rollback", "plan", "phases", "staging", "testing", "monitoring", "metrics", 
        "alert", "tradeoff", "technical debt", "backlog", "priority", "refactor", 
        "risk", "fallback", "feature flag"
    }
    
    CONTRADICTION_PATTERNS = [
        (r"\breact\s+(?:is\s+(?:a\s+|an\s+)?)(?:(?:backend|relational|nosql|sql)\s+)?database\b", "React is an interactive UI library, not a database or storage engine."),
        (r"\breact\s+(?:is\s+(?:a\s+|an\s+)?)sql\b", "React is an interactive UI library, not SQL."),
        (r"\bhtml\s+(?:is\s+(?:a\s+|an\s+)?)?(?:compiles|programming language that compiles|backend language)\b", "HTML is a declarative markup language, not a compiled backend programming language."),
        (r"\b(delete|drop)\s+(?:the\s+)?production\s+(?:database)?\s+(?:without\s+backup|with\s+no\s+backup|directly)\b", "Destructive operations in production without backup violate safe operational practices."),
        (r"\b(disable|turn off|remove)\s+(?:all\s+)?(?:security|authentication|auth|passwords)\s+(?:to\s+(?:make\s+it\s+)?(?:faster|speed|optimize))\b", "Disabling security or authentication to gain performance is a critical anti-pattern."),
        (r"\b(sql injection)\s+(?:can be fixed by|is prevented by)\s+(?:using\s+)?(?:raw queries|concatenat(?:ing|ion))\b", "String concatenation in SQL queries causes SQL injection rather than preventing it."),
        (r"\bgit push\s+(?:deletes|erases)\s+(?:all\s+)?(?:commits|repository)\b", "Incorrect assertion about git version control semantics."),
        (r"\bcookies\s+(?:store|are used to store)\s+(?:all\s+)?(?:backend|database)\s+tables\b", "Cookies are small client-side HTTP tokens, not backend database storage.")
    ]

    @classmethod
    def is_empty_or_skip(cls, answer: str) -> bool:
        if not answer:
            return True
        clean = answer.strip().lower()
        if len(clean) < 3:
            return True
        if clean in cls.COMMON_SKIP_WORDS:
            return True
        alpha_chars = re.sub(r'[^a-zA-Z0-9]', '', clean)
        if len(alpha_chars) < 3:
            return True
        return False

    @classmethod
    def is_gibberish_or_random(cls, answer: str) -> bool:
        clean = (answer or "").strip().lower()
        letters_only = re.sub(r'[^a-zA-Z]', '', clean)
        if not letters_only:
            return False
            
        # Keyboard mashing
        for mash in cls.KEYBOARD_MASH_PATTERNS:
            if mash in clean and len(clean) <= 40:
                return True
                
        # Character repetition (e.g. "aaaaa", "zzzzzz")
        if re.search(r'([a-zA-Z])\1{4,}', clean):
            return True
            
        # Low distinct character ratio in long text
        if len(letters_only) >= 15:
            distinct = len(set(letters_only))
            if distinct <= 4:
                return True
                
        # Consonant clusters / very low vowel ratio
        if len(letters_only) >= 12:
            vowels = sum(1 for c in letters_only if c in 'aeiou')
            if vowels / len(letters_only) < 0.12:
                return True
                
        # Repetitive single word (e.g. "test test test test")
        words = [w for w in re.split(r'\s+', clean) if w]
        if len(words) >= 4 and len(set(words)) == 1:
            return True
            
        return False

    @classmethod
    def extract_keywords(cls, text: str) -> set:
        words = re.findall(r'[a-zA-Z0-9]+', text.lower())
        return {w for w in words if len(w) > 2 and w not in cls.STOP_WORDS}

    @classmethod
    def get_lemma(cls, w: str) -> str:
        w = w.lower()
        for s in ['ability', 'able', 'ation', 'tion', 'ment', 'ings', 'ing', 'ers', 'er', 'ies', 'es', 'ed', 'ate', 's']:
            if len(w) > len(s) + 3 and w.endswith(s):
                return w[:-len(s)]
        return w

    @classmethod
    def is_word_variant(cls, w1: str, w2: str) -> bool:
        if w1 == w2:
            return True
        l1 = cls.get_lemma(w1).rstrip('e')
        l2 = cls.get_lemma(w2).rstrip('e')
        return l1 == l2 and len(l1) >= 3

    @classmethod
    def calculate_overlap(cls, set_a: set, set_b: set) -> set:
        matched = set()
        for a in set_a:
            for b in set_b:
                if cls.is_word_variant(a, b):
                    matched.add(a)
                    break
        return matched

    @classmethod
    def check_contradictions(cls, answer: str) -> Tuple[bool, str]:
        lower_ans = answer.lower()
        for pattern, explanation in cls.CONTRADICTION_PATTERNS:
            if re.search(pattern, lower_ans):
                return True, explanation
        return False, ""

    @classmethod
    def evaluate(cls, question: str, answer: str, stage: str, required_skills: List[str] = None) -> Dict[str, Any]:
        """
        Evaluate candidate's answer strictly and objectively.
        Returns a complete evaluation dictionary with individual scores (0-10) and feedback.
        """
        required_skills = required_skills or []
        stage = (stage or "technical").lower()
        
        # 1. EMPTY / SKIPPED
        if cls.is_empty_or_skip(answer):
            return {
                "overall_score": 0.0,
                "completeness_score": 0.0,
                "relevance_score": 0.0,
                "technical_score": 0.0,
                "communication_score": 0.0,
                "problem_solving_score": 0.0,
                "strengths": [],
                "weaknesses": ["No answer provided or question skipped by candidate."],
                "feedback": "Question was skipped or left blank without response.",
                "red_flags": ["Question skipped without response"]
            }
            
        # 2. GIBBERISH / RANDOM CHARACTERS
        if cls.is_gibberish_or_random(answer):
            return {
                "overall_score": 0.0,
                "completeness_score": 0.0,
                "relevance_score": 0.0,
                "technical_score": 0.0,
                "communication_score": 0.0,
                "problem_solving_score": 0.0,
                "strengths": [],
                "weaknesses": ["Candidate submitted random keystrokes or meaningless characters."],
                "feedback": "Response contains random or unintelligible characters with zero relevance.",
                "red_flags": ["Candidate submitted gibberish/unprofessional random text"]
            }
            
        # 3. RELEVANCE & TOPIC OVERLAP ANALYSIS
        q_keywords = cls.extract_keywords(question)
        ans_keywords = cls.extract_keywords(answer)
        words = answer.split()
        word_count = len(words)
        
        # Domain terms dictionary for current stage
        domain_terms = set()
        if stage == 'technical':
            domain_terms = cls.TECHNICAL_TERMS | {s.lower() for s in required_skills}
        elif stage == 'behavioral':
            domain_terms = cls.BEHAVIORAL_TERMS
        elif stage == 'situational':
            domain_terms = cls.SITUATIONAL_TERMS
        elif stage == 'qa':
            domain_terms = {"culture", "team", "growth", "roadmap", "stack", "technology", "mentorship", "process", "deploy", "engineering", "vision"}
        else:
            domain_terms = cls.TECHNICAL_TERMS

        q_overlap = cls.calculate_overlap(q_keywords, ans_keywords)
        domain_overlap = cls.calculate_overlap(domain_terms, ans_keywords)
        
        # Check completely irrelevant / off-topic
        # If no question keyword matched AND no domain term matched
        if len(q_overlap) == 0 and len(domain_overlap) == 0:
            return {
                "overall_score": 0.0,
                "completeness_score": 0.0,
                "relevance_score": 0.0,
                "technical_score": 0.0,
                "communication_score": 1.0 if word_count > 5 else 0.0,
                "problem_solving_score": 0.0,
                "strengths": [],
                "weaknesses": ["Response is completely off-topic and irrelevant to the question asked."],
                "feedback": "Candidate provided an irrelevant response with zero relation to the question topic.",
                "red_flags": ["Irrelevant, off-topic response"]
            }
            
        # 4. TECHNICAL CONTRADICTIONS / INCORRECT TECHNICAL STATEMENTS
        has_contradiction, explanation = cls.check_contradictions(answer)
        if has_contradiction:
            return {
                "overall_score": 1.5,
                "completeness_score": 2.0,
                "relevance_score": 3.0,
                "technical_score": 1.0,
                "communication_score": 3.0,
                "problem_solving_score": 1.0,
                "strengths": [],
                "weaknesses": [
                    f"Technically inaccurate: {explanation}",
                    "Demonstrated misconceptions regarding core system architecture and safe practices"
                ],
                "feedback": f"Technically incorrect answer: {explanation}",
                "red_flags": [f"Technical misconception: {explanation}"]
            }

        # 5. GRADED EVALUATION (Partially Correct, Moderate, High)
        relevance_score = min(10.0, max(1.0, (len(q_overlap) * 2.5) + (len(domain_overlap) * 1.5)))
        
        if stage == 'technical':
            # Technical scoring factors:
            # - Domain terms count (breadth)
            # - Depth indicators (tradeoffs, edge cases, performance, security)
            # - Concrete explanation length
            depth_terms = {"trade-off", "tradeoff", "latency", "scale", "performance", "optimization", "security", "concurrency", "test", "testing", "edge case", "fallback", "memory", "cache", "async"}
            has_depth = any(t in answer.lower() for t in depth_terms)
            
            if word_count < 25 or len(domain_overlap) <= 2:
                # Partially correct: brief answer, basic definition, lacks depth
                overall_score = 4.0 if (len(q_overlap) > 0 or len(domain_overlap) > 0) else 2.5
                strengths = ["Mentions foundational concepts related to the topic"]
                weaknesses = ["Lacks technical depth, practical implementation details, and architectural trade-offs"]
                feedback = "Candidate demonstrated basic conceptual awareness, but the answer lacks technical depth and practical nuances."
            elif len(domain_overlap) >= 3 and (word_count < 55 and not has_depth):
                # Moderate: Good understanding of basic principles, lacks advanced nuance
                overall_score = 6.5
                strengths = [
                    "Accurate explanation of core components and patterns",
                    "Clear articulation of development principles"
                ]
                weaknesses = ["Could further elaborate on high-concurrency trade-offs, scalability, and testing"]
                feedback = "Accurate and relevant response covering key principles with clear technical clarity."
            elif len(domain_overlap) >= 4 and (has_depth or word_count >= 50):
                # High: Comprehensive, accurate, structured
                overall_score = min(9.5, 8.0 + (0.3 * len(domain_overlap)) + (0.5 if has_depth else 0.0))
                strengths = [
                    "Strong technical depth and architectural clarity",
                    "Practical understanding of performance optimizations and trade-offs"
                ]
                weaknesses = []
                feedback = "Comprehensive and technically accurate answer demonstrating solid practical engineering knowledge."
            else:
                overall_score = 4.5
                strengths = ["Relevant to the question"]
                weaknesses = ["Could provide more technical depth and concrete implementation examples"]
                feedback = "Candidate addressed the topic with acceptable fundamentals but limited technical depth."

            return {
                "overall_score": round(overall_score, 1),
                "completeness_score": round(min(10.0, overall_score + 0.2), 1),
                "relevance_score": round(min(10.0, relevance_score), 1),
                "technical_score": round(overall_score, 1),
                "communication_score": round(min(10.0, 5.0 + (word_count / 20.0)), 1),
                "problem_solving_score": round(overall_score, 1),
                "strengths": strengths if overall_score >= 4.0 else [],
                "weaknesses": weaknesses,
                "feedback": feedback,
                "red_flags": []
            }

        elif stage == 'behavioral':
            # Behavioral scoring factors:
            # Check for STAR indicators: situation, action taken, resolution
            has_action = any(w in answer.lower() for w in ["i decided", "we discussed", "i proposed", "i took", "i investigated", "my role", "i communicated"])
            has_outcome = any(w in answer.lower() for w in ["result", "resolved", "outcome", "learned", "delivered", "improved", "successfully", "compromise"])
            
            if word_count < 20:
                overall_score = 4.0
                strengths = ["Shared brief context"]
                weaknesses = ["Lacks specific details on actions taken and measured outcomes (STAR methodology)"]
                feedback = "Brief response with limited detail on problem resolution and collaboration."
            elif has_action and has_outcome:
                overall_score = min(9.0, 7.5 + (0.5 if word_count > 40 else 0.0))
                strengths = [
                    "Structured behavioral response effectively detailing personal action and outcome",
                    "Demonstrates collaborative mindset and constructive conflict resolution"
                ]
                weaknesses = []
                feedback = "Well-structured behavioral response demonstrating strong ownership, empathy, and constructive resolution."
            else:
                overall_score = 6.0
                strengths = ["Demonstrates awareness of collaborative team dynamics"]
                weaknesses = ["Could provide more concrete evidence of quantifiable results and lessons learned"]
                feedback = "Relevant behavioral example; could benefit from more structured STAR methodology."

            return {
                "overall_score": round(overall_score, 1),
                "completeness_score": round(min(10.0, overall_score + 0.3), 1),
                "relevance_score": round(min(10.0, relevance_score), 1),
                "technical_score": round(overall_score * 0.8, 1),
                "communication_score": round(min(10.0, 6.0 + (word_count / 25.0)), 1),
                "problem_solving_score": round(overall_score, 1),
                "strengths": strengths if overall_score >= 4.0 else [],
                "weaknesses": weaknesses,
                "feedback": feedback,
                "red_flags": []
            }

        elif stage == 'situational':
            # Situational scoring:
            # e.g., migration with zero downtime, prioritization of tech debt
            has_steps = any(w in answer.lower() for w in ["first", "then", "plan", "phase", "step", "rollback", "test", "dual", "canary", "blue"])
            if word_count < 20:
                overall_score = 4.0
                strengths = ["Identifies immediate goal"]
                weaknesses = ["Missing step-by-step risk mitigation and rollback strategy"]
                feedback = "Basic situational answer lacking detailed operational execution planning."
            elif has_steps and len(domain_overlap) >= 3:
                overall_score = min(9.2, 8.0 + (0.3 * len(domain_overlap)))
                strengths = [
                    "Pragmatic, structured engineering approach to complex situational scenarios",
                    "Clear focus on risk mitigation, zero downtime, and verification"
                ]
                weaknesses = []
                feedback = "Comprehensive situational strategy demonstrating seasoned engineering foresight and operational rigor."
            else:
                overall_score = 6.5
                strengths = ["Logical approach to system migration and prioritization"]
                weaknesses = ["Could detail rollback triggers, monitoring metrics, and stakeholder updates"]
                feedback = "Solid situational reasoning with good practical awareness of system stability."

            return {
                "overall_score": round(overall_score, 1),
                "completeness_score": round(min(10.0, overall_score + 0.2), 1),
                "relevance_score": round(min(10.0, relevance_score), 1),
                "technical_score": round(overall_score, 1),
                "communication_score": round(min(10.0, 6.0 + (word_count / 25.0)), 1),
                "problem_solving_score": round(overall_score, 1),
                "strengths": strengths if overall_score >= 4.0 else [],
                "weaknesses": weaknesses,
                "feedback": feedback,
                "red_flags": []
            }

        elif stage == 'qa':
            # Q&A stage: candidate asking questions
            if any(w in answer.lower() for w in ["no", "none", "nothing", "no questions", "i don't have"]):
                overall_score = 3.0
                strengths = []
                weaknesses = ["Candidate had no questions regarding company culture, technical roadmap, or team dynamics"]
                feedback = "Candidate did not ask any questions about the role or organization."
            elif any(w in answer.lower() for w in ["culture", "tech stack", "roadmap", "mentorship", "growth", "challenge", "deploy", "team"]):
                overall_score = 8.5
                strengths = ["Demonstrated genuine curiosity regarding engineering culture and technological roadmap"]
                weaknesses = []
                feedback = "Thoughtful, high-signal questions demonstrating strong candidate engagement and cultural interest."
            else:
                overall_score = 5.5
                strengths = ["Candidate engaged in Q&A session"]
                weaknesses = ["Could ask deeper questions about technical vision and engineering practices"]
                feedback = "Engaged in Q&A with standard inquiry."

            return {
                "overall_score": round(overall_score, 1),
                "completeness_score": round(overall_score, 1),
                "relevance_score": round(min(10.0, relevance_score), 1),
                "technical_score": round(overall_score, 1),
                "communication_score": round(overall_score, 1),
                "problem_solving_score": round(overall_score, 1),
                "strengths": strengths if overall_score >= 4.0 else [],
                "weaknesses": weaknesses,
                "feedback": feedback,
                "red_flags": []
            }

        # Fallback
        return {
            "overall_score": 5.0,
            "completeness_score": 5.0,
            "relevance_score": 5.0,
            "technical_score": 5.0,
            "communication_score": 5.0,
            "problem_solving_score": 5.0,
            "strengths": [],
            "weaknesses": [],
            "feedback": "Answer recorded.",
            "red_flags": []
        }
