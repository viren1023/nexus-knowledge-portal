"""
Seed script for Nexus AI Benchmark Suite.
Provisions personas, project, fabricated documents with role access tags,
Git repository, tasks across lifecycle, and exercises chatbot task creation.
"""

import os
import sys
import time
import json
import logging
import urllib.request
import urllib.parse
from uuid import UUID
import yaml

from safety import validate_safety

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("benchmark.seed")

BENCH_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BENCH_DIR, "config.yml")
PERSONAS_PATH = os.path.join(BENCH_DIR, "personas", "personas.yml")
DOCS_DIR = os.path.join(BENCH_DIR, "corpus", "fabricated_docs")
REPO_DIR = os.path.join(BENCH_DIR, "corpus", "repo")
SEED_STATE_PATH = os.path.join(BENCH_DIR, "seed_state.json")


def load_yaml(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def api_request(base_url: str, path: str, method: str = "GET", data: dict = None, token: str = None) -> dict:
    url = f"{base_url}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    req_body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_bytes = resp.read()
        if not res_bytes:
            return {}
        return json.loads(res_bytes.decode("utf-8"))


def upload_multipart_document(base_url: str, project_id: str, file_path: str, role_access: str, token: str) -> dict:
    """Upload a document file via multipart/form-data."""
    boundary = "----BenchmarkBoundary7MA4YWxkTrZu0gW"
    filename = os.path.basename(file_path)
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="role_access"\r\n\r\n'
        f"{role_access}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: text/markdown\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        f"{base_url}/api/projects/{project_id}/documents/upload",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {token}"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ensure_developers_exist(config: dict, personas_list: list):
    """
    Ensure the simulated personas exist in the target database.
    Connects to target DB or creates via direct query if running in shadow stack.
    """
    db_url = config.get("target", {}).get("db_url")
    if not db_url:
        return

    from sqlalchemy import create_engine, text
    import uuid

    engine = create_engine(db_url)
    with engine.connect() as conn:
        for p in personas_list:
            skills_json = json.dumps(p["skills"])
            conn.execute(
                text("""
                INSERT INTO developers (id, name, email, role, skills)
                VALUES (:id, :name, :email, :role, CAST(:skills AS jsonb))
                ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    role = EXCLUDED.role,
                    skills = EXCLUDED.skills;
                """),
                {
                    "id": uuid.uuid4(),
                    "name": p["name"],
                    "email": p["email"],
                    "role": p["role"],
                    "skills": skills_json
                }
            )
        conn.commit()
    logger.info(f"✅ Verified {len(personas_list)} developer persona accounts in benchmark DB.")


def seed_benchmark_environment(config: dict = None) -> dict:
    if not config:
        config = load_yaml(CONFIG_PATH)

    validate_safety(config)
    base_url = config["target"]["base_url"]
    personas_data = load_yaml(PERSONAS_PATH)["personas"]

    logger.info(f"🚀 Initializing benchmark seed against {base_url}...")

    # Step 1: Ensure personas exist in DB
    ensure_developers_exist(config, personas_data)

    # Step 2: Authenticate all personas and obtain JWT tokens
    tokens = {}
    user_ids = {}
    for p in personas_data:
        login_res = api_request(base_url, "/api/auth/login", method="POST", data={"email": p["email"]})
        tokens[p["id"]] = login_res["token"]
        user_ids[p["id"]] = login_res["user_id"]
        logger.info(f"🔑 Authenticated persona {p['id']} ({p['role']}) -> {login_res['email']}")

    pm_token = tokens["bench_pm"]

    # Step 3: Create isolated Project
    project_payload = {
        "name": "Aurora Telemetry Engine [Benchmark]",
        "description": "High-performance real-time telemetry collector, anomaly detector, and multi-channel alerting service.",
        "color": "indigo"
    }
    project_res = api_request(base_url, "/api/projects", method="POST", data=project_payload, token=pm_token)
    project_id = project_res.get("project_id") or project_res.get("project", {}).get("id") or project_res.get("id")
    logger.info(f"📁 Created benchmark project: {project_id} - '{project_payload['name']}'")

    # Step 4: Add members to project with respective roles
    for p in personas_data:
        if p["id"] == "bench_pm":
            continue  # Creator is already member
        member_payload = {
            "developer_id": user_ids[p["id"]],
            "role": p["role"]
        }
        try:
            api_request(base_url, f"/api/projects/{project_id}/members", method="POST", data=member_payload, token=pm_token)
            logger.info(f"👥 Added member {p['name']} ({p['role']}) to project.")
        except Exception as e:
            logger.warning(f"Could not add member {p['name']}: {e}")

    # Step 5: Upload fabricated documents with specific role access tags
    docs_to_upload = [
        ("project_charter_aurora.md", "all"),
        ("architecture_decisions_aurora.md", "all"),
        ("sprint_14_notes.md", "all"),
        ("sprint_15_notes.md", "all"),
        ("developer_workflow_standards.md", "developer"),
        ("executive_onboarding_compensation.md", "manager")  # Critical security test doc
    ]

    uploaded_docs = {}
    job_ids = []
    for doc_name, role_access in docs_to_upload:
        doc_path = os.path.join(DOCS_DIR, doc_name)
        if os.path.exists(doc_path):
            doc_res = upload_multipart_document(base_url, project_id, doc_path, role_access, pm_token)
            uploaded_docs[doc_name] = doc_res
            if doc_res.get("job_id"):
                job_ids.append(doc_res["job_id"])
            logger.info(f"📄 Uploaded {doc_name} with role_access='{role_access}' -> doc_id: {doc_res.get('document_id')}")

    # Step 6: Upload local Git Repository
    repo_res = None
    if os.path.exists(REPO_DIR):
        repo_url = "/benchmark/corpus/repo" if config.get("mode") == "shadow-stack" else REPO_DIR
        repo_payload = {
            "repo_url": repo_url,
            "repo_name": "aurora-telemetry-engine",
            "role_access": "all"
        }
        try:
            repo_res = api_request(base_url, f"/api/projects/{project_id}/repos/upload", method="POST", data=repo_payload, token=pm_token)
            if repo_res.get("job_id"):
                job_ids.append(repo_res["job_id"])
            logger.info(f"🐙 Linked Git repository '{repo_payload['repo_name']}' -> repo_id: {repo_res.get('repo_id')}")
        except Exception as e:
            logger.error(f"Failed to upload git repo: {e}")

    # Step 7: Create 18 baseline tasks across lifecycle
    tasks_to_create = [
        {
            "title": "TASK-101: Implement HMAC-SHA256 Token Verification",
            "description": "Implement verify_hmac_signature with constant-time comparison in service.auth.jwt_handler to prevent timing attacks.",
            "status": "in_progress",
            "priority": "high",
            "assigned_to": user_ids["bench_dev1"],
            "due_date": "2026-09-10"  # OVERDUE
        },
        {
            "title": "TASK-102: Build Prometheus Metrics Exporter",
            "description": "Expose OpenMetrics text endpoint in service.metrics.collector for scraping by Prometheus agent.",
            "status": "review",
            "priority": "medium",
            "assigned_to": user_ids["bench_dev2"],
            "due_date": "2026-10-15"
        },
        {
            "title": "TASK-103: Automated Load Testing Suite for Ingestion Pipeline",
            "description": "Build Locust benchmark targeting 50,000 events/sec throughput with sub-100ms latency validation.",
            "status": "todo",
            "priority": "high",
            "assigned_to": user_ids["bench_qa"],
            "due_date": "2026-10-20"
        },
        {
            "title": "TASK-104: Slack Webhook Rate Limiting Backoff",
            "description": "Add exponential jitter backoff on HTTP 429 response codes in service.notifier.dispatcher.",
            "status": "done",
            "priority": "medium",
            "assigned_to": user_ids["bench_dev2"],
            "due_date": "2026-09-18"
        },
        {
            "title": "TASK-105: Memory Leak Investigation in Welford Z-Score Algorithm",
            "description": "Profile memory allocations during continuous single-pass Welford updates over 24 hours.",
            "status": "backlog",
            "priority": "high",
            "assigned_to": user_ids["bench_dev1"],
            "due_date": "2026-10-30"
        },
        {
            "title": "TASK-106: Setup Redis Streams XACK offset commit handler",
            "description": "Ensure telemetry ingestion workers commit stream consumer offsets after database write.",
            "status": "in_progress",
            "priority": "critical",
            "assigned_to": user_ids["bench_lead"],
            "due_date": "2026-10-05"
        },
        {
            "title": "TASK-107: SOC-2 Audit Logging Trail Integration",
            "description": "Integrate structured JSON audit logs for compliance with SOC-2 Type II mandate.",
            "status": "todo",
            "priority": "high",
            "assigned_to": user_ids["bench_dev1"],
            "due_date": "2026-11-01"
        },
        {
            "title": "TASK-108: PagerDuty Events API v2 Routing Key Rotation",
            "description": "Support zero-downtime rotation of integration routing keys in dispatcher service.",
            "status": "done",
            "priority": "low",
            "assigned_to": user_ids["bench_dev2"],
            "due_date": "2026-09-12"
        },
        {
            "title": "TASK-109: TimescaleDB Continuous Aggregates 5-Minute Bucket",
            "description": "Define continuous aggregates for mean_val, peak_val, and sample_count rollups.",
            "status": "review",
            "priority": "medium",
            "assigned_to": user_ids["bench_lead"],
            "due_date": "2026-10-12"
        },
        {
            "title": "TASK-110: Pytest-asyncio Error Handling Tests",
            "description": "Achieve 85% test coverage requirement specified in developer workflow standards.",
            "status": "in_progress",
            "priority": "medium",
            "assigned_to": user_ids["bench_qa"],
            "due_date": "2026-10-18"
        }
    ]

    created_tasks = []
    for t_data in tasks_to_create:
        try:
            t_res = api_request(base_url, f"/api/projects/{project_id}/tasks", method="POST", data=t_data, token=pm_token)
            created_tasks.append(t_res)
        except Exception as e:
            logger.warning(f"Could not create task '{t_data['title']}': {e}")
    logger.info(f"📋 Seeded {len(created_tasks)} baseline project tasks across workflow states.")

    # Step 8: Exercise chatbot task creation flow directly (task_create + confirm)
    try:
        session_res = api_request(base_url, f"/api/projects/{project_id}/chat/session/start", method="POST", token=pm_token)
        bench_chat_session_id = session_res.get("session_id")
        
        chat_create_msg = {
            "session_id": bench_chat_session_id,
            "message": "Create a task to audit JWT expiration TTL with high priority due on 2026-11-10"
        }
        draft_res = api_request(base_url, f"/api/projects/{project_id}/chat/message", method="POST", data=chat_create_msg, token=pm_token)
        logger.info(f"🤖 Chatbot drafted task: {draft_res.get('intent')} - {draft_res.get('suggested_task')}")

        # Confirm the drafted task
        confirm_msg = {
            "session_id": bench_chat_session_id,
            "message": "Yes, create it"
        }
        confirm_res = api_request(base_url, f"/api/projects/{project_id}/chat/message", method="POST", data=confirm_msg, token=pm_token)
        logger.info(f"✅ Chatbot confirmed and created task: {confirm_res.get('suggested_task')}")
    except Exception as e:
        logger.warning(f"Could not complete chatbot task_create exercise: {e}")

    # Step 9: Poll for ingestion completion
    logger.info("⏳ Polling ingestion pipeline until documents & assets are indexed...")
    max_wait = config.get("timeouts", {}).get("ingestion_max_wait", 120)
    start_time = time.time()
    indexed_ok = False

    while time.time() - start_time < max_wait:
        try:
            content_res = api_request(base_url, f"/api/projects/{project_id}/chat/check-content", method="GET", token=pm_token)
            doc_cnt = content_res.get("document_count", 0)
            asset_cnt = content_res.get("asset_count", 0)
            task_cnt = content_res.get("task_count", 0)
            logger.info(f"  ... Ingestion progress: {doc_cnt} doc chunks, {asset_cnt} code assets, {task_cnt} tasks")
            if doc_cnt > 0 and task_cnt > 0:
                indexed_ok = True
                break
        except Exception:
            pass
        time.sleep(3)

    if indexed_ok:
        logger.info("🎉 Ingestion pipeline complete! Project is fully seeded and indexed.")
    else:
        logger.warning("⚠️ Ingestion polling reached timeout; proceeding with available indexed content.")

    state = {
        "project_id": str(project_id),
        "tokens": tokens,
        "user_ids": user_ids,
        "base_url": base_url,
        "uploaded_docs": uploaded_docs,
        "tasks_count": len(created_tasks),
        "seeded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    with open(SEED_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

    return state


if __name__ == "__main__":
    seed_benchmark_environment()
