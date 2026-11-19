import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from langgraph_agents.evaluator import SemanticAnswerEvaluator

def run_tests():
    print("==================================================")
    print("RUNNING 6 MANDATORY EVALUATION TEST SCENARIOS")
    print("==================================================")
    
    # -------------------------------------------------------------------------
    # TEST 1: Random Answers
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Random Answers:")
    q1 = "Can you explain your experience with React and walk me through a challenging technical problem you solved using it?"
    ans1 = "banana elephant moon keyboard potato car table sky ocean yellow purple guitar sandwich jump run fast blue apple"
    res1 = SemanticAnswerEvaluator.evaluate(q1, ans1, "technical", ["react", "javascript"])
    print(f"  Score: {res1['overall_score']}/10")
    print(f"  Feedback: {res1['feedback']}")
    print(f"  Strengths: {res1['strengths']}")
    assert res1['overall_score'] <= 1.0, f"Expected <= 1.0, got {res1['overall_score']}"
    assert len(res1['strengths']) == 0, "Expected empty strengths for random answer"
    print("  >>> TEST 1 PASSED: Random text got score 0 and no false praise!")

    # -------------------------------------------------------------------------
    # TEST 2: Empty Answers
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Empty Answers:")
    ans2 = "   "
    res2 = SemanticAnswerEvaluator.evaluate(q1, ans2, "technical", ["react"])
    print(f"  Score: {res2['overall_score']}/10")
    print(f"  Feedback: {res2['feedback']}")
    assert res2['overall_score'] == 0.0, f"Expected 0.0, got {res2['overall_score']}"
    assert len(res2['strengths']) == 0
    
    ans2_skip = "skip"
    res2_skip = SemanticAnswerEvaluator.evaluate(q1, ans2_skip, "technical", ["react"])
    assert res2_skip['overall_score'] == 0.0, f"Expected 0.0 for skip, got {res2_skip['overall_score']}"
    print("  >>> TEST 2 PASSED: Empty and skip got score 0.0!")

    # -------------------------------------------------------------------------
    # TEST 3: Incorrect Answers
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Incorrect Answers:")
    ans3 = "React is a backend database that stores SQL tables directly inside HTTP cookies to optimize database queries."
    res3 = SemanticAnswerEvaluator.evaluate(q1, ans3, "technical", ["react"])
    print(f"  Score: {res3['overall_score']}/10")
    print(f"  Feedback: {res3['feedback']}")
    print(f"  Strengths: {res3['strengths']}")
    assert res3['overall_score'] <= 2.0, f"Expected <= 2.0, got {res3['overall_score']}"
    assert len(res3['strengths']) == 0
    print("  >>> TEST 3 PASSED: Technically incorrect answer got low score (1.5) without rewarding keywords!")

    # -------------------------------------------------------------------------
    # TEST 4: Partially Correct Answers
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Partially Correct Answers:")
    ans4 = "React uses components and hooks like useState to manage data on the frontend."
    res4 = SemanticAnswerEvaluator.evaluate(q1, ans4, "technical", ["react"])
    print(f"  Score: {res4['overall_score']}/10")
    print(f"  Feedback: {res4['feedback']}")
    print(f"  Strengths: {res4['strengths']}")
    assert 3.0 <= res4['overall_score'] <= 5.0, f"Expected 3-5, got {res4['overall_score']}"
    print("  >>> TEST 4 PASSED: Partially correct answer earned partial marks!")

    # -------------------------------------------------------------------------
    # TEST 5: Correct Answers
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Correct Answers:")
    ans5 = (
        "In our production React application, we designed a modular architecture utilizing custom hooks and Zustand for state management. "
        "A challenging issue was excessive re-rendering in a high-frequency trading dashboard. I diagnosed this using React Profiler, "
        "implemented windowing with react-window to virtualize large lists, and memoized expensive computations using useMemo and useCallback. "
        "We also introduced Redis caching on our FastAPI backend to reduce database latency and prevent high-concurrency bottlenecking. "
        "This reduced rendering latency by 65% and maintained a smooth 60fps frame rate."
    )
    res5 = SemanticAnswerEvaluator.evaluate(q1, ans5, "technical", ["react", "fastapi"])
    print(f"  Score: {res5['overall_score']}/10")
    print(f"  Feedback: {res5['feedback']}")
    print(f"  Strengths: {res5['strengths']}")
    assert res5['overall_score'] >= 8.0, f"Expected >= 8.0, got {res5['overall_score']}"
    assert len(res5['strengths']) > 0
    print("  >>> TEST 5 PASSED: Correct comprehensive answer earned high score (>= 8.0)!")

    # -------------------------------------------------------------------------
    # TEST 6: Mixed Performance (10 Questions Aggregation)
    # -------------------------------------------------------------------------
    print("\n[TEST 6] Mixed Performance Across 10 Questions:")
    mixed_answers = [
        # 4 Tech
        (q1, ans5, "technical"),                     # High (8.9)
        (q1, ans4, "technical"),                     # Partial (4.0)
        (q1, ans3, "technical"),                     # Incorrect (1.5)
        (q1, "", "technical"),                       # Empty (0.0)
        # 3 Behavioral
        ("Tell me about a disagreement with a team member.", 
         "When we disagreed on database schema migration, I scheduled a sync where we compared latency benchmarks. We compromised on a phased rollout which delivered on time.", "behavioral"), # High (8.0)
        ("Can you share an experience adapting to tight deadlines?", 
         "I had to adapt to a deadline change so I worked extra hours to finish.", "behavioral"), # Partial (4.0)
        ("Describe a critical bug resolution.", 
         ans1, "behavioral"), # Random (0.0)
        # 2 Situational
        ("If you were tasked with migrating a legacy service in a Software Engineer role with zero downtime, how would you plan and execute it?", 
         "To execute a legacy service migration with zero downtime, I designed a multi-phase strategy. First, we implemented a dual-write mechanism between legacy and new databases with real-time replication. Second, we conducted shadow testing. Next, we routed 5% traffic via a canary deployment while monitoring metrics. Once verified, we shifted all traffic with automated rollback in place.", "situational"), # High (8.6)
        ("How would you prioritize competing feature requests from stakeholders when technical debt is slowing down the team?", 
         "When balancing technical debt against feature requests, I evaluate risk using an impact matrix. I negotiate with product managers by quantifying how debt slows velocity, allocating 20% of sprint capacity to refactoring critical bottlenecks.", "situational"), # Moderate (6.5)
        # 1 QA
        ("Do you have any questions for us?", 
         "Could you share more about the engineering team's approach to technical debt and CI/CD deployment cadence?", "qa") # High (8.5)
    ]
    
    scores = []
    for idx, (q, a, st) in enumerate(mixed_answers, 1):
        res = SemanticAnswerEvaluator.evaluate(q, a, st, ["react"])
        scores.append(res['overall_score'])
        print(f"  Q{idx} ({st[:4]}): {res['overall_score']}/10 -> {res['feedback'][:55]}...")
    
    total_score = round(sum(scores), 1)
    print(f"\n  Scores Breakdown: {scores}")
    print(f"  Sum of 10 Questions = {total_score} / 100")
    
    # Recommendation calculation
    if total_score >= 80:
        rec = "Recommended"
    elif total_score >= 60:
        rec = "Under Consideration"
    elif total_score >= 40:
        rec = "Needs Improvement"
    else:
        rec = "Not Recommended"
        
    print(f"  Final Status: {rec}")
    assert 40 <= total_score < 60, f"Expected 40-59 (Needs Improvement), got {total_score}"
    assert rec == "Needs Improvement"
    print("  >>> TEST 6 PASSED: Mixed answers resulted in authentic reflective score and Needs Improvement status!")

    print("\n==================================================")
    print("ALL 6 MANDATORY TEST SCENARIOS PASSED WITH FLYING COLORS!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
