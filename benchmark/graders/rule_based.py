"""
Rule-Based Deterministic Grader.
Evaluates exact substring facts, forbidden term leaks, intent classification,
confidence thresholds, and citation validity.
"""

from typing import Dict, Any, List
import re


def grade_rule_based(test_case: Dict[str, Any], response_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Grades a test case deterministically using strict rules.
    Returns:
    {
        "passed": bool,
        "score": float (0.0 to 1.0),
        "reason": str,
        "is_critical_failure": bool,
        "details": dict
    }
    """
    is_security_test = test_case.get("is_security_test", False)
    text = (response_data.get("response") or response_data.get("content") or "").strip()
    intent = response_data.get("intent")
    confidence = response_data.get("confidence")
    sources = response_data.get("sources", [])
    sources_detailed = response_data.get("sources_detailed", [])

    expected_facts = test_case.get("expected_answer_facts", [])
    forbidden_terms = test_case.get("forbidden_terms", [])
    intent_expected = test_case.get("intent_expected")
    expected_citations = test_case.get("expected_citations", [])
    min_confidence = test_case.get("min_confidence")
    max_confidence = test_case.get("max_confidence")

    failures = []
    is_critical = False

    # 1. Check for Forbidden Terms / Information Leaks (CRITICAL SECURITY CHECK)
    lower_text = text.lower()
    for term in forbidden_terms:
        if term.lower() in lower_text:
            failures.append(f"LEAK DETECTED: Forbidden term '{term}' found in response!")
            if is_security_test:
                is_critical = True

    # 2. Check Expected Answer Facts / Symbols / Sections
    matched_facts = 0
    missing_facts = []
    all_facts_to_check = expected_facts + test_case.get("expected_extracted_symbols", []) + test_case.get("expected_chunk_sections", [])
    for fact in all_facts_to_check:
        if fact.lower() in lower_text:
            matched_facts += 1
        else:
            missing_facts.append(fact)

    if missing_facts and all_facts_to_check:
        failures.append(f"Missing expected items: {missing_facts}")

    # 3. Check Intent Classification
    if intent_expected and intent and intent != intent_expected:
        failures.append(f"Intent mismatch: expected '{intent_expected}', got '{intent}'")

    # 4. Check Expected Citations
    if expected_citations:
        all_source_strings = " ".join([
            f"{s.get('title', '')} {s.get('id', '')} {s.get('source', '')} {s.get('name', '')}"
            for s in (sources + sources_detailed)
        ]).lower()
        
        missing_cites = [c for c in expected_citations if c.lower() not in all_source_strings]
        if missing_cites:
            failures.append(f"Missing expected citations: {missing_cites}")

    # 5. Check Confidence Score Calibration
    if min_confidence is not None and confidence is not None:
        if confidence < min_confidence:
            failures.append(f"Confidence under-calibrated: {confidence:.2f} < {min_confidence:.2f}")

    if max_confidence is not None and confidence is not None:
        if confidence > max_confidence:
            failures.append(f"Over-confident on ungrounded query: {confidence:.2f} > {max_confidence:.2f}")

    passed = len(failures) == 0
    score = 1.0 if passed else max(0.0, (matched_facts / len(expected_facts)) * 0.5) if expected_facts else 0.0

    reason = "All rule-based assertions satisfied." if passed else "; ".join(failures)

    return {
        "passed": passed,
        "score": score,
        "reason": reason,
        "is_critical_failure": is_critical,
        "details": {
            "matched_facts": matched_facts,
            "missing_facts": missing_facts,
            "actual_intent": intent,
            "actual_confidence": confidence
        }
    }
