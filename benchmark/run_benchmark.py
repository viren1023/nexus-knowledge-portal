"""
Main Test Harness Runner for Nexus AI Benchmark Suite.
Walks through data-driven YAML fixtures, executes requests via FastAPI endpoints,
grades results using deterministic rule-based and LLM-judge engines, and records metrics.
"""

import os
import sys
import glob
import time
import json
import logging
import urllib.request
from typing import Dict, Any, List
import yaml

from safety import validate_safety
from graders.rule_based import grade_rule_based
from graders.llm_judge import grade_with_llm_judge

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("benchmark.harness")

BENCH_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BENCH_DIR, "config.yml")
FIXTURES_DIR = os.path.join(BENCH_DIR, "fixtures")
SEED_STATE_PATH = os.path.join(BENCH_DIR, "seed_state.json")
REPORTS_DIR = os.path.join(BENCH_DIR, "reports")


def load_yaml(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def execute_api_call(base_url: str, endpoint: str, data: dict, token: str, timeout: int = 45) -> tuple[dict, float]:
    """Execute API call and measure latency in milliseconds."""
    url = f"{base_url}{endpoint}"
    req_body = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    req = urllib.request.Request(url, data=req_body, headers=headers, method="POST")
    
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        res_bytes = resp.read()
        latency_ms = (time.perf_counter() - t0) * 1000.0
        parsed = json.loads(res_bytes.decode("utf-8")) if res_bytes else {}
        return parsed, latency_ms


def run_test_case(tc: dict, category: str, base_url: str, project_id: str, tokens: dict, config: dict) -> dict:
    persona_id = tc.get("persona", "bench_dev1")
    token = tokens.get(persona_id)
    if not token:
        token = next(iter(tokens.values()))

    grader_type = tc.get("grader_type", "rule_based")
    endpoint_type = tc.get("endpoint", "chat")
    query = tc.get("query", "")

    raw_response = {}
    latency_ms = 0.0
    err_message = None

    try:
        if endpoint_type == "chat":
            chat_payload = {
                "message": query
            }
            raw_response, latency_ms = execute_api_call(
                base_url,
                f"/api/projects/{project_id}/chat/message",
                chat_payload,
                token,
                timeout=config.get("timeouts", {}).get("request_timeout", 45)
            )

            # If test case has follow-up turn, execute multi-turn follow-up
            if tc.get("follow_up_query") and raw_response.get("session_id"):
                follow_up_payload = {
                    "session_id": raw_response.get("session_id"),
                    "message": tc["follow_up_query"]
                }
                raw_response, lat2 = execute_api_call(
                    base_url,
                    f"/api/projects/{project_id}/chat/message",
                    follow_up_payload,
                    token,
                    timeout=config.get("timeouts", {}).get("request_timeout", 90)
                )
                latency_ms += lat2

            # If test case tests task cancellation / confirmation gating
            if tc.get("cancel_message") and raw_response.get("session_id"):
                cancel_payload = {
                    "session_id": raw_response.get("session_id"),
                    "message": tc["cancel_message"]
                }
                raw_response, lat2 = execute_api_call(
                    base_url,
                    f"/api/projects/{project_id}/chat/message",
                    cancel_payload,
                    token,
                    timeout=config.get("timeouts", {}).get("request_timeout", 90)
                )
                latency_ms += lat2

        elif endpoint_type == "search":
            search_payload = {
                "query": query,
                "page": 1,
                "page_size": 10
            }
            raw_response, latency_ms = execute_api_call(
                base_url,
                f"/api/projects/{project_id}/search",
                search_payload,
                token
            )
            # Normalize search results into response text for graders
            results = raw_response.get("results", [])
            raw_response["response"] = " ".join([f"{r.get('title', '')} {r.get('snippet', '')}" for r in results])
            raw_response["sources"] = results

        elif endpoint_type == "assets":
            from sqlalchemy import create_engine, text
            engine = create_engine(config["target"]["db_url"])
            t0 = time.perf_counter()
            with engine.connect() as conn:
                rows = conn.execute(text("""
                    SELECT ra.asset_name, ra.file_path, ra.full_signature, ra.call_count
                    FROM reusable_assets ra
                    JOIN git_repos gr ON ra.repo_id = gr.id
                    WHERE gr.project_id = :pid
                """), {"pid": project_id}).fetchall()
                symbols = [r[0] for r in rows if r[0]]
                raw_response = {
                    "response": " ".join(symbols) + " " + " ".join([r[2] or "" for r in rows]),
                    "symbols": symbols,
                    "rows": [dict(r._mapping) for r in rows]
                }
            latency_ms = (time.perf_counter() - t0) * 1000.0

        elif endpoint_type == "documents":
            from sqlalchemy import create_engine, text
            engine = create_engine(config["target"]["db_url"])
            t0 = time.perf_counter()
            with engine.connect() as conn:
                rows = conn.execute(text("""
                    SELECT dc.chunk_path, dc.content
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE d.project_id = :pid
                """), {"pid": project_id}).fetchall()
                sections = [r[0] for r in rows if r[0]]
                raw_response = {
                    "response": " ".join(sections) + " " + " ".join([r[1] or "" for r in rows]),
                    "sections": sections
                }
            latency_ms = (time.perf_counter() - t0) * 1000.0

    except Exception as e:
        err_message = str(e)
        raw_response = {"response": "", "error": err_message}

    # Grade response
    if err_message:
        grading = {
            "passed": False,
            "score": 0.0,
            "reason": f"API request failed with exception: {err_message}",
            "is_critical_failure": tc.get("is_security_test", False)
        }
    elif grader_type == "llm_judge":
        ollama_url = config.get("target", {}).get("ollama_url", "http://localhost:11434")
        judge_model = config.get("judge", {}).get("model", "mistral:7b")
        grading = grade_with_llm_judge(tc, raw_response, ollama_url=ollama_url, model=judge_model)
    else:
        grading = grade_rule_based(tc, raw_response)

    return {
        "id": tc["id"],
        "name": tc["name"],
        "category": category,
        "persona": persona_id,
        "query": query,
        "latency_ms": round(latency_ms, 2),
        "passed": grading["passed"],
        "score": grading["score"],
        "reason": grading["reason"],
        "is_critical_failure": grading.get("is_critical_failure", False),
        "is_security_test": tc.get("is_security_test", False),
        "actual_intent": raw_response.get("intent"),
        "expected_intent": tc.get("intent_expected"),
        "confidence": raw_response.get("confidence"),
        "response_excerpt": (raw_response.get("response") or "")[:250],
        "full_response": raw_response.get("response", ""),
        "sources": raw_response.get("sources", []),
        "details": grading.get("details", {})
    }


def run_benchmark(category_filter: str = None, dry_run: bool = False) -> dict:
    config = load_yaml(CONFIG_PATH)
    validate_safety(config)

    if not os.path.exists(SEED_STATE_PATH):
        if dry_run:
            seed_state = {
                "base_url": config["target"]["base_url"],
                "project_id": "dummy-project-id",
                "tokens": {"bench_dev1": "dummy-token", "bench_pm": "dummy-token"}
            }
        else:
            raise RuntimeError(f"Seed state file not found at {SEED_STATE_PATH}. Run seed.py first.")
    else:
        with open(SEED_STATE_PATH, "r", encoding="utf-8") as f:
            seed_state = json.load(f)

    base_url = seed_state["base_url"]
    project_id = seed_state["project_id"]
    tokens = seed_state["tokens"]

    logger.info(f"🏁 Starting benchmark run on {base_url} (Project: {project_id})...")

    fixture_files = sorted(glob.glob(os.path.join(FIXTURES_DIR, "*.yml")))
    all_results = []
    
    start_time = time.time()

    for fpath in fixture_files:
        fix_data = load_yaml(fpath)
        category = fix_data.get("category", os.path.splitext(os.path.basename(fpath))[0])
        
        if category_filter and category != category_filter:
            continue

        test_cases = fix_data.get("test_cases", [])
        logger.info(f"▶️ Category '{category}': running {len(test_cases)} tests...")

        for tc in test_cases:
            if dry_run:
                logger.info(f"  [DRY-RUN] Would execute {tc['id']}: '{tc['name']}'")
                continue

            res = run_test_case(tc, category, base_url, project_id, tokens, config)
            status_icon = "✅" if res["passed"] else ("🚨 CRITICAL" if res["is_critical_failure"] else "❌")
            logger.info(f"  {status_icon} [{res['id']}] {res['name']} ({res['latency_ms']:.1f}ms) -> {res['reason']}")
            all_results.append(res)

    duration_s = time.time() - start_time
    logger.info(f"🏁 Benchmark execution finished in {duration_s:.2f} seconds ({len(all_results)} test cases).")

    os.makedirs(REPORTS_DIR, exist_ok=True)
    raw_path = os.path.join(REPORTS_DIR, "raw_results.json")
    if category_filter and os.path.exists(raw_path):
        try:
            with open(raw_path, "r", encoding="utf-8") as f:
                prev_data = json.load(f)
                prev_results = [r for r in prev_data.get("results", []) if r.get("category") != category_filter]
                all_results = prev_results + all_results
        except Exception:
            pass

    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump({
            "run_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "duration_seconds": round(duration_s, 2),
            "project_id": project_id,
            "results": all_results
        }, f, indent=2)

    return {
        "duration_seconds": duration_s,
        "results": all_results,
        "raw_results_path": raw_path
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run Nexus AI Benchmark Suite")
    parser.add_argument("--category", type=str, default=None, help="Filter by category name")
    parser.add_argument("--dry-run", action="store_true", help="Print cases without firing network calls")
    args = parser.parse_args()

    run_benchmark(category_filter=args.category, dry_run=args.dry_run)
