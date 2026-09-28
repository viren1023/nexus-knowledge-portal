# 🛡️ Nexus AI Benchmark & Gap-Analysis Report
**Generated:** 2026-09-27T08:39:43Z | **Duration:** 578.85s | **Target Project:** `48ad3e04-3d49-4803-811f-4699dcf8e7d7`

## 🛡️ Security & Access Control: CLEAN
✅ Zero role-based access control leaks detected across restricted documents.

## 📊 Executive Scorecard
| Metric | Result |
|---|---|
| **Overall Pass Rate** | **63.6%** (21/33) |
| **Critical Security Leaks** | **0** |
| **Total Benchmark Duration** | 578.85s |
| **Test Categories Evaluated** | 8 |

### Score by Capability Category
| Category | Total | Passed | Failed | Pass Rate | Avg Latency |
|---|---|---|---|---|---|
| ✅ `access_control` | 5 | 5 | 0 | **100.0%** | 13529.9ms |
| ⚠️ `asset_search` | 4 | 3 | 1 | **75.0%** | 31002.5ms |
| ⚠️ `edge_cases` | 3 | 0 | 3 | **0.0%** | 40165.5ms |
| ✅ `ingestion` | 2 | 2 | 0 | **100.0%** | 27.1ms |
| ⚠️ `knowledge_qa` | 7 | 2 | 5 | **28.6%** | 24022.1ms |
| ⚠️ `project_summary` | 2 | 1 | 1 | **50.0%** | 18710.9ms |
| ✅ `search` | 4 | 4 | 0 | **100.0%** | 50.4ms |
| ⚠️ `task_management` | 6 | 4 | 2 | **66.7%** | 9451.1ms |

## 🎯 Confidence Calibration Analysis
| Confidence Range | Total Queries | Passed | Accuracy |
|---|---|---|---|
| 0.0 - 0.50 (Low) | 0 | 0 | **0.0%** |
| 0.50 - 0.70 (Moderate) | 0 | 0 | **0.0%** |
| 0.70 - 0.85 (High) | 0 | 0 | **0.0%** |
| 0.85 - 1.00 (Very High) | 27 | 15 | **55.6%** |

## ⚡ Latency Profile by Intent
| Intent | Count | p50 Latency | p95 Latency | Min | Max |
|---|---|---|---|---|---|
| `asset_search` | 4 | 30745.2ms | 49429.7ms | 13090.0ms | 49429.7ms |
| `knowledge_qa` | 7 | 6877.5ms | 11647.7ms | 3680.5ms | 11647.7ms |
| `other` | 6 | 41.7ms | 60.8ms | 24.6ms | 60.8ms |
| `project_overview` | 2 | 43885.7ms | 46237.7ms | 41533.6ms | 46237.7ms |
| `project_summary` | 2 | 18710.9ms | 28967.8ms | 8454.0ms | 28967.8ms |
| `task_cancel` | 1 | 11967.7ms | 11967.7ms | 11967.7ms | 11967.7ms |
| `task_create` | 1 | 9390.5ms | 9390.5ms | 9390.5ms | 9390.5ms |
| `task_query` | 10 | 16327.5ms | 70163.2ms | 2876.9ms | 70163.2ms |

## 🔍 Actionable Gaps & Recommendations
- **Intent Classifier Drift**: 8 queries were routed to an unexpected intent handler.
- **Over-confidence on Erroneous Answers**: 12 failed queries returned confidence > 0.80.

## 📋 Detailed Failure Transcripts
### 1. [AST-04] Find Slack message card formatter (asset_search)
- **Persona:** `bench_dev2` | **Latency:** 22303.79ms
- **Query:** *"Find reusable code that formats Slack notification cards"*
- **Grader Finding:** Missing expected items: ['format_slack_notification_card']
- **Actual AI Response:**
  >  Based on the provided context, there isn't a specific piece of code that formats Slack notification cards directly mentioned. However, the project's architecture ([8]) suggests that Aurora delivers sub-100ms alerts to Slack, implying that there might be code for Slack integration.

To find the relevant code, you could look for files or modules related to Slack notifications within the project's s...

### 2. [EDG-01] Out of scope query handling (edge_cases)
- **Persona:** `bench_dev1` | **Latency:** 8799.76ms
- **Query:** *"What is the recommended recipe for traditional Italian sourdough pizza?"*
- **Grader Finding:** Over-confident on ungrounded query: 0.85 > 0.65
- **Actual AI Response:**
  >  The provided context does not contain information about a recipe for traditional Italian sourdough pizza. The documents provided discuss various topics related to project development, such as code review and approval rules, project constraints, and testing practices, but there is no mention of a pizza recipe. I'm unable to answer the user's question based on the provided context....

### 3. [EDG-02] Empty or whitespace message handling (edge_cases)
- **Persona:** `bench_dev1` | **Latency:** 70163.18ms
- **Query:** *"   "*
- **Grader Finding:** Intent mismatch: expected 'unclear', got 'task_query'
- **Actual AI Response:**
  >  Here are the tasks with their current status and priority:

1. TASK-101: Implement HMAC-SHA256 Token Verification
   - Status: in_progress
   - Priority: high
   - Assigned to: Devon Reed
   - Due: 2026-09-10

2. TASK-102: Build Prometheus Metrics Exporter
   - Status: review
   - Priority: medium
   - Assigned to: Sara Chen
   - Due: 2026-10-15

3. TASK-103: Automated Load Testing Suite for Inge...

### 4. [EDG-03] Extremely long adversarial prompt string (edge_cases)
- **Persona:** `bench_dev2` | **Latency:** 41533.58ms
- **Query:** *"Tell me about the system architecture. Tell me about the system architecture. Tell me about the system architecture. Tell me about the system architecture. Tell me about the system architecture. Tell me about the system architecture. Tell me about the system architecture. Tell me about the system architecture. Tell me about the system architecture. Tell me about the system architecture."*
- **Grader Finding:** Intent mismatch: expected 'knowledge_qa', got 'project_overview'
- **Actual AI Response:**
  >  The project is named Aurora Telemetry Engine, and it is written in Python. The system architecture involves processing streaming time-series telemetry events via Redis Streams. It runs sliding-window statistical anomaly checks and delivers sub-100ms alerts to Slack, PagerDuty, and HTTP webhook subscribers.

Key modules of the system include:
1. `service.auth.jwt_handler`: This module provides fun...

### 5. [KQA-01] Throughput and latency targets recall (knowledge_qa)
- **Persona:** `bench_dev1` | **Latency:** 12704.99ms
- **Query:** *"What are the target throughput and alerting latency goals for Project Aurora?"*
- **Grader Finding:** Intent mismatch: expected 'knowledge_qa', got 'task_query'
- **Actual AI Response:**
  >  Based on the context provided, the high priority task TASK-103: Automated Load Testing Suite for Ingestion Pipeline specifies a target of 50,000 events/sec throughput and does not mention any specific alerting latency goals. However, it is important to note that the latency validation for sub-100ms latency is also part of this task. For further clarification, you may want to consult with the pers...

### 6. [KQA-04] Project key milestones and budget recall (knowledge_qa)
- **Persona:** `bench_pm` | **Latency:** 47749.23ms
- **Query:** *"What is the total budget and the target date for the Phase 1 Beta release?"*
- **Grader Finding:** Missing expected items: ['420,000', 'November 15, 2026']; Intent mismatch: expected 'knowledge_qa', got 'task_query'
- **Actual AI Response:**
  >  To answer your question, I need to gather information from the tasks that have a Due date within the Phase 1 Beta release timeline, which is not explicitly mentioned in the context. However, based on the given dates, I assume Phase 1 Beta release might be around October 2026.

For the total budget, it's challenging to calculate without knowing the hourly rates, overtime costs, and any additional ...

### 7. [KQA-05] Citation grounded verification (knowledge_qa)
- **Persona:** `bench_lead` | **Latency:** 58305.56ms
- **Query:** *"What anomaly detection algorithm was chosen in ADR-003?"*
- **Grader Finding:** Intent mismatch: expected 'knowledge_qa', got 'task_query'; Missing expected citations: ['architecture_decisions_aurora']
- **Actual AI Response:**
  >  To answer your question, I would need to refer to ADR-003 (Architecture Decision Record 003), which is not provided in the context. However, I can provide you with the current tasks related to the project:

1. Task: Implement HMAC-SHA256 Token Verification (Status: in_progress, Priority: high, Assigned to: Devon Reed, Due: 2026-09-10)
2. Task: Build Prometheus Metrics Exporter (Status: review, Pr...

### 8. [KQA-06] Confidence calibration - unanswerable query control (knowledge_qa)
- **Persona:** `bench_dev1` | **Latency:** 8025.15ms
- **Query:** *"What brand of coffee machine is installed in the Aurora breakroom on floor 3?"*
- **Grader Finding:** Intent mismatch: expected 'knowledge_qa', got 'task_query'; Over-confident on ungrounded query: 0.85 > 0.65
- **Actual AI Response:**
  >  I'm sorry for any confusion, but it seems that the context provided does not contain information about the coffee machine in the Aurora breakroom on floor 3. The context only includes tasks related to a project. If you have any questions about the tasks or need help with them, I'd be happy to assist!...

### 9. [KQA-07] Multi-turn context continuity (knowledge_qa)
- **Persona:** `bench_dev1` | **Latency:** 22768.93ms
- **Query:** *"Who is the executive sponsor for Aurora?"*
- **Grader Finding:** Missing expected items: ['Marcus Vance', 'Chief Technology Officer']; Intent mismatch: expected 'knowledge_qa', got 'task_query'
- **Actual AI Response:**
  >  Based on the context provided, the assigned tasks indicate that Devon Reed is a developer, as he is assigned tasks related to coding and implementation (TASK-101, TASK-105, TASK-106, and TASK-107). Sara Chen is an engineer or developer as well, as she is assigned tasks related to coding and review (TASK-102, TASK-104, TASK-108, and TASK-109). However, it's important to note that official titles m...

### 10. [SUM-02] Architectural components summary (project_summary)
- **Persona:** `bench_lead` | **Latency:** 8453.97ms
- **Query:** *"Summarize the architectural storage components chosen for Project Aurora."*
- **Grader Finding:** Missing expected items: ['PostgreSQL']
- **Actual AI Response:**
  >  The chosen architectural storage component for Project Aurora is Redis Streams. It is used for processing streaming time-series telemetry events. This component enables Aurora to handle over 50,000 telemetry events per second and ensures sub-100ms alerting latency. Additionally, configuration variables are managed via environment variables....
