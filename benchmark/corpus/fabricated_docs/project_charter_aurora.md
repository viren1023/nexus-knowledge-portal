# Project Charter: Aurora Real-Time Metrics & Alerting Engine

## 1. Executive Summary & Goals
Project Aurora is the next-generation unified real-time metrics telemetry and anomaly detection platform for the enterprise. 
The primary objective of Aurora is to process over 50,000 telemetry events per second with sub-100 millisecond alerting latency.

## 2. Key Stakeholders
- **Executive Sponsor:** Dr. Marcus Vance (Chief Technology Officer)
- **Product Manager:** Patricia Moore (`bench_pm@aurora.internal`)
- **Technical Lead:** Leonard Thorne (`bench_lead@aurora.internal`)
- **Principal Architect:** Elena Rostova

## 3. Scope and Deliverables
- **Core Engine:** High-performance asynchronous metric stream collector written in Python 3.11 with FastAPI.
- **Anomaly Detection:** Real-time sliding window Z-score statistical evaluation and percentile threshold alerting.
- **Alert Dispatcher:** Multi-channel notification pipeline supporting Slack incoming webhooks, PagerDuty Events API v2, and customized HMAC-SHA256 authenticated HTTP webhooks.
- **Storage Tier:** Hybrid storage using Redis Streams for the ephemeral 24-hour ingestion buffer and PostgreSQL with TimescaleDB extension for historical rollups.

## 4. Project Constraints & Target Deadlines
- Total allocated engineering budget: $420,000 USD.
- Compliance mandate: SOC-2 Type II audit compliance by Q4 2026.
- Phase 1 Beta Release milestone target: November 15, 2026.
- Phase 2 General Availability (GA) milestone target: January 30, 2027.
