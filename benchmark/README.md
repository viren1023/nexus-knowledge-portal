# 🛡️ Nexus AI Benchmark Suite

Automated, isolated, reproducible benchmark and gap-analysis evaluation framework for the Nexus Knowledge Portal AI pipeline (ingestion → task management → chatbot Q&A → search/discovery).

---

## 1. Architecture & Design Principles

- **API-Only:** Interacts exclusively through existing FastAPI REST endpoints (`/api/auth`, `/api/projects`, `/api/tasks`, `/api/chat`, `/api/search`).
- **Option A Shadow Stack (100% Isolated):** Runs against a separate parallel `docker-compose.bench.yml` stack on independent ports (`8005`, `5435`, `6381`) with its own database (`knowledge_portal_bench`). Zero production data is ever read or written.
- **Safety Guardrails:** `safety.py` halts execution immediately if target URL or database matches default development or production ports (5432, 5433, 8000).
- **Self-Erasing:** Automatic teardown wipes all containers, networks, and persistent database volumes unless `--keep` is passed.
- **Automated Grading:** Rule-based deterministic grading for facts/leaks/intents + LLM-as-judge for open-ended summaries.

---

## 2. Directory Structure

```text
benchmark/
├── docker-compose.bench.yml    # Isolated shadow stack (postgres, redis, backend, worker)
├── config.yml                  # Benchmark target configuration and safety rules
├── safety.py                   # Hard-fail production isolation guardrails
├── seed.py                     # API-based workspace and persona provisioner
├── run_benchmark.py            # Fixture walker and test runner
├── report.py                   # Markdown and HTML scorecard generator
├── teardown.py                 # Self-erasing cleanup handler
├── run.py                      # Master single-command orchestrator
├── personas/
│   └── personas.yml            # 5 simulated company personas (manager, lead, dev, qa)
├── corpus/
│   ├── ground_truth.yml        # Ground-truth answer keys and RBAC policies
│   ├── fabricated_docs/        # Project charter, ADRs, sprint notes, executive compensation
│   └── repo/                   # Real initialized Git repository (Aurora telemetry engine)
├── fixtures/
│   ├── knowledge_qa.yml        # Factual recall, citations, calibration
│   ├── task_management.yml     # Task queries, overdue checks, confirmation gating
│   ├── asset_search.yml        # Code search and reusability ranking
│   ├── project_summary.yml     # High-level architecture summarization
│   ├── access_control.yml      # Security & RBAC leak tests (CRITICAL)
│   ├── search.yml              # Direct hybrid search retrieval
│   ├── edge_cases.yml          # Out-of-scope, empty, prompt injection
│   └── ingestion.yml           # AST code extraction and chunking
└── reports/                    # Generated Markdown and HTML reports
```

---

## 3. Quick Start

### Run complete benchmark suite (standup → seed → evaluate → report → teardown):
```bash
python benchmark/run.py
```

### Dry-run (inspect test cases without firing requests):
```bash
python benchmark/run.py --dry-run
```

### Run single category (e.g. access control security tests):
```bash
python benchmark/run.py --category access_control --keep
```

### Keep shadow stack running for manual Swagger inspection:
```bash
python benchmark/run.py --keep
# Shadow Swagger UI available at: http://localhost:8005/docs
```

### Manual Teardown:
```bash
python benchmark/teardown.py
```

---

## 4. Personas & Roles

| Persona | Role | Email | Permissions & Purpose |
|---|---|---|---|
| `bench_pm` | manager | `bench_pm@aurora.internal` | Full access; queries confidential executive compensation |
| `bench_lead` | team_lead | `bench_lead@aurora.internal` | Task assignments, ADR decisions, code assets |
| `bench_dev1` | developer | `bench_dev1@aurora.internal` | Overdue task owner; must be blocked from manager compensation |
| `bench_dev2` | developer | `bench_dev2@aurora.internal` | Code assets and general developer workflow standards |
| `bench_qa` | qa | `bench_qa@aurora.internal` | Testing suites; role-filtered search checks |

---

## 5. Report Outputs

Each run generates:
1. `benchmark/reports/benchmark_report.md` (GitHub-flavored Markdown report with critical findings first)
2. `benchmark/reports/benchmark_report.html` (Standalone styled HTML scorecard)
3. `benchmark/reports/raw_results.json` (Complete raw test results, latencies, and responses)
