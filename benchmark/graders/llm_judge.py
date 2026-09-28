"""
LLM-as-a-Judge Grader for open-ended answers and project summaries.
Uses a strict rubric comparing the actual answer against ground-truth facts.
"""

import json
import logging
import urllib.request
from typing import Dict, Any

from .rule_based import grade_rule_based

logger = logging.getLogger("benchmark.judge")


def grade_with_llm_judge(
    test_case: Dict[str, Any],
    response_data: Dict[str, Any],
    ollama_url: str = "http://localhost:11434",
    model: str = "mistral:7b"
) -> Dict[str, Any]:
    """
    Grades open-ended output using an LLM evaluator with a strict rubric.
    """
    actual_response = (response_data.get("response") or response_data.get("content") or "").strip()
    query = test_case.get("query", "")
    rubric = test_case.get("judge_rubric", "Does the answer accurately convey the required facts without contradictions or hallucinations?")
    expected_facts = test_case.get("expected_answer_facts", [])
    forbidden_terms = test_case.get("forbidden_terms", [])

    # Check forbidden terms first deterministically
    rule_res = grade_rule_based(test_case, response_data)
    if rule_res.get("is_critical_failure"):
        return rule_res

    prompt = f"""You are an impartial, strict evaluation judge for an enterprise AI knowledge portal.
You will evaluate an AI assistant's response against a specific rubric and expected ground-truth facts.

[USER QUERY]
{query}

[GROUND-TRUTH FACTS REQUIRED]
{json.dumps(expected_facts)}

[FORBIDDEN / CONTRADICTORY TERMS]
{json.dumps(forbidden_terms)}

[GRADING RUBRIC]
{rubric}

[ACTUAL AI RESPONSE TO EVALUATE]
{actual_response}

Instructions:
1. Check if the response includes the ground-truth facts accurately.
2. Check if the response contains any hallucinations or mentions forbidden terms.
3. Respond ONLY with a valid JSON object in the exact format:
{{"passed": true, "score": 1.0, "reason": "Accurately summarized key facts."}}
OR
{{"passed": false, "score": 0.3, "reason": "Failed to mention throughput target and included hallucinated components."}}
"""

    try:
        req_data = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.0,
                "num_predict": 256
            }
        }
        
        req = urllib.request.Request(
            f"{ollama_url}/api/generate",
            data=json.dumps(req_data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw_out = json.loads(resp.read().decode("utf-8"))
            judge_text = raw_out.get("response", "{}")
            parsed_judge = json.loads(judge_text)

            passed = bool(parsed_judge.get("passed", False))
            score = float(parsed_judge.get("score", 1.0 if passed else 0.0))
            reason = parsed_judge.get("reason", "Graded by LLM Judge.")

            return {
                "passed": passed,
                "score": score,
                "reason": f"[LLM Judge] {reason}",
                "is_critical_failure": False,
                "details": {
                    "judge_model": model,
                    "raw_judge_output": parsed_judge
                }
            }

    except Exception as e:
        logger.warning(f"LLM Judge evaluation failed ({e}); falling back to rule-based evaluation.")
        fallback = grade_rule_based(test_case, response_data)
        fallback["reason"] = f"[Fallback Rule Grader] {fallback['reason']}"
        return fallback
