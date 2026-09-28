"""
Report generator for Nexus AI Benchmark Suite.
Produces comprehensive Markdown and standalone HTML gap-analysis reports,
highlighting critical security findings first, scorecards, confusion matrices,
confidence calibration, latency distributions, and actionable gaps.
"""

import os
import sys
import json
import statistics
from collections import defaultdict
from typing import Dict, Any, List

BENCH_DIR = os.path.dirname(os.path.abspath(__file__))
REPORTS_DIR = os.path.join(BENCH_DIR, "reports")
RAW_RESULTS_PATH = os.path.join(REPORTS_DIR, "raw_results.json")


def generate_benchmark_reports(raw_data: Dict[str, Any] = None) -> tuple[str, str]:
    if not raw_data:
        if not os.path.exists(RAW_RESULTS_PATH):
            raise FileNotFoundError(f"Raw results file not found at {RAW_RESULTS_PATH}")
        with open(RAW_RESULTS_PATH, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

    results: List[Dict[str, Any]] = raw_data.get("results", [])
    duration_s = raw_data.get("duration_seconds", 0)
    run_timestamp = raw_data.get("run_timestamp", "N/A")
    project_id = raw_data.get("project_id", "N/A")

    total_tests = len(results)
    passed_tests = sum(1 for r in results if r["passed"])
    failed_tests = total_tests - passed_tests
    overall_pass_pct = (passed_tests / total_tests * 100.0) if total_tests > 0 else 0.0

    # 1. Critical Security Findings
    critical_failures = [r for r in results if r.get("is_critical_failure") or (r.get("is_security_test") and not r["passed"])]

    # 2. Category Scorecard
    category_map = defaultdict(list)
    for r in results:
        category_map[r["category"]].append(r)

    category_stats = {}
    for cat, items in category_map.items():
        cat_total = len(items)
        cat_passed = sum(1 for i in items if i["passed"])
        cat_pct = (cat_passed / cat_total * 100.0) if cat_total > 0 else 0.0
        latencies = [i["latency_ms"] for i in items if i.get("latency_ms")]
        avg_lat = statistics.mean(latencies) if latencies else 0.0
        category_stats[cat] = {
            "total": cat_total,
            "passed": cat_passed,
            "failed": cat_total - cat_passed,
            "pass_pct": cat_pct,
            "avg_latency": avg_lat
        }

    # 3. Intent Classification Confusion Analysis
    confusion = defaultdict(lambda: defaultdict(int))
    for r in results:
        exp = r.get("expected_intent") or "none"
        act = r.get("actual_intent") or "none"
        if exp != "none":
            confusion[exp][act] += 1

    # 4. Confidence Calibration (Buckets: 0-0.5, 0.5-0.7, 0.7-0.9, 0.9-1.0)
    buckets = {
        "0.0 - 0.50 (Low)": {"total": 0, "correct": 0},
        "0.50 - 0.70 (Moderate)": {"total": 0, "correct": 0},
        "0.70 - 0.85 (High)": {"total": 0, "correct": 0},
        "0.85 - 1.00 (Very High)": {"total": 0, "correct": 0},
    }
    for r in results:
        conf = r.get("confidence")
        if conf is not None:
            if conf < 0.50:
                b = "0.0 - 0.50 (Low)"
            elif conf < 0.70:
                b = "0.50 - 0.70 (Moderate)"
            elif conf < 0.85:
                b = "0.70 - 0.85 (High)"
            else:
                b = "0.85 - 1.00 (Very High)"
            buckets[b]["total"] += 1
            if r["passed"]:
                buckets[b]["correct"] += 1

    # 5. Latency Distribution by Intent
    intent_latencies = defaultdict(list)
    for r in results:
        act_intent = r.get("actual_intent") or r.get("expected_intent") or "other"
        if r.get("latency_ms"):
            intent_latencies[act_intent].append(r["latency_ms"])

    latency_table = {}
    for intent, lats in intent_latencies.items():
        sorted_lats = sorted(lats)
        p50 = statistics.median(sorted_lats)
        p95 = sorted_lats[int(len(sorted_lats) * 0.95)] if len(sorted_lats) >= 20 else sorted_lats[-1]
        latency_table[intent] = {
            "p50": round(p50, 1),
            "p95": round(p95, 1),
            "min": round(min(sorted_lats), 1),
            "max": round(max(sorted_lats), 1),
            "count": len(sorted_lats)
        }

    # 6. Actionable Gaps Summary
    failures = [r for r in results if not r["passed"]]
    gap_points = []
    if critical_failures:
        gap_points.append(f"**CRITICAL RBAC LEAK**: {len(critical_failures)} test case(s) leaked restricted data to unauthorized personas.")
    
    intent_mismatches = sum(1 for r in results if r.get("expected_intent") and r.get("actual_intent") != r.get("expected_intent"))
    if intent_mismatches > 0:
        gap_points.append(f"**Intent Classifier Drift**: {intent_mismatches} queries were routed to an unexpected intent handler.")

    high_conf_fails = [r for r in failures if (r.get("confidence") or 0) > 0.80]
    if high_conf_fails:
        gap_points.append(f"**Over-confidence on Erroneous Answers**: {len(high_conf_fails)} failed queries returned confidence > 0.80.")

    if not gap_points:
        gap_points.append("All baseline security, knowledge, and task benchmarks satisfied expectations.")

    # -------------------------------------------------------------
    # BUILD MARKDOWN REPORT
    # -------------------------------------------------------------
    md = []
    md.append(f"# 🛡️ Nexus AI Benchmark & Gap-Analysis Report")
    md.append(f"**Generated:** {run_timestamp} | **Duration:** {duration_s}s | **Target Project:** `{project_id}`\n")

    # Critical Findings Section FIRST
    if critical_failures:
        md.append("## 🚨 CRITICAL FINDINGS: Role-Based Access Control Failures")
        md.append("> [!CAUTION]\n> The following tests exposed unauthorized or restricted data to personas without proper credentials.\n")
        for cf in critical_failures:
            md.append(f"### ❌ [{cf['id']}] {cf['name']}")
            md.append(f"- **Persona:** `{cf['persona']}` (Unauthorized)")
            md.append(f"- **Query:** *\"{cf['query']}\"*")
            md.append(f"- **Failure Reason:** {cf['reason']}")
            md.append(f"- **Exposed Response:**\n  ```text\n  {cf['response_excerpt']}\n  ```\n")
    else:
        md.append("## 🛡️ Security & Access Control: CLEAN")
        md.append("✅ Zero role-based access control leaks detected across restricted documents.\n")

    # Overall Scorecard
    md.append("## 📊 Executive Scorecard")
    md.append(f"| Metric | Result |")
    md.append(f"|---|---|")
    md.append(f"| **Overall Pass Rate** | **{overall_pass_pct:.1f}%** ({passed_tests}/{total_tests}) |")
    md.append(f"| **Critical Security Leaks** | **{len(critical_failures)}** |")
    md.append(f"| **Total Benchmark Duration** | {duration_s}s |")
    md.append(f"| **Test Categories Evaluated** | {len(category_stats)} |\n")

    md.append("### Score by Capability Category")
    md.append("| Category | Total | Passed | Failed | Pass Rate | Avg Latency |")
    md.append("|---|---|---|---|---|---|")
    for cat, cs in sorted(category_stats.items()):
        status = "✅" if cs["failed"] == 0 else "⚠️"
        md.append(f"| {status} `{cat}` | {cs['total']} | {cs['passed']} | {cs['failed']} | **{cs['pass_pct']:.1f}%** | {cs['avg_latency']:.1f}ms |")
    md.append("")

    # Confidence Calibration
    md.append("## 🎯 Confidence Calibration Analysis")
    md.append("| Confidence Range | Total Queries | Passed | Accuracy |")
    md.append("|---|---|---|---|")
    for b_name, b_data in buckets.items():
        acc = (b_data["correct"] / b_data["total"] * 100.0) if b_data["total"] > 0 else 0.0
        md.append(f"| {b_name} | {b_data['total']} | {b_data['correct']} | **{acc:.1f}%** |")
    md.append("")

    # Latency Profile
    md.append("## ⚡ Latency Profile by Intent")
    md.append("| Intent | Count | p50 Latency | p95 Latency | Min | Max |")
    md.append("|---|---|---|---|---|---|")
    for intent, lat in sorted(latency_table.items()):
        md.append(f"| `{intent}` | {lat['count']} | {lat['p50']}ms | {lat['p95']}ms | {lat['min']}ms | {lat['max']}ms |")
    md.append("")

    # Actionable Gaps Summary
    md.append("## 🔍 Actionable Gaps & Recommendations")
    for gp in gap_points:
        md.append(f"- {gp}")
    md.append("")

    # Detailed Failures List
    if failures:
        md.append("## 📋 Detailed Failure Transcripts")
        for idx, f_item in enumerate(failures[:10], 1):
            md.append(f"### {idx}. [{f_item['id']}] {f_item['name']} ({f_item['category']})")
            md.append(f"- **Persona:** `{f_item['persona']}` | **Latency:** {f_item['latency_ms']}ms")
            md.append(f"- **Query:** *\"{f_item['query']}\"*")
            md.append(f"- **Grader Finding:** {f_item['reason']}")
            md.append(f"- **Actual AI Response:**")
            md.append(f"  > {f_item['full_response'][:400]}...\n")

    markdown_content = "\n".join(md)

    # -------------------------------------------------------------
    # BUILD HTML REPORT
    # -------------------------------------------------------------
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nexus AI Benchmark Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; padding: 32px 16px; margin: 0; }}
    .container {{ max-width: 1000px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }}
    h1 {{ color: #0f172a; margin-top: 0; }}
    h2 {{ color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; }}
    .critical-banner {{ background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; margin: 24px 0; color: #991b1b; }}
    .clean-banner {{ background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 16px; margin: 24px 0; color: #166534; font-weight: 600; }}
    table {{ width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }}
    th, td {{ padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; }}
    th {{ background: #f8fafc; font-weight: 600; }}
    .badge-pass {{ background: #dcfce7; color: #15803d; padding: 4px 8px; border-radius: 6px; font-weight: bold; }}
    .badge-fail {{ background: #fee2e2; color: #b91c1c; padding: 4px 8px; border-radius: 6px; font-weight: bold; }}
    .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px; }}
    pre {{ background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 13px; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>🛡️ Nexus AI Benchmark & Gap-Analysis Report</h1>
    <p><strong>Generated:</strong> {run_timestamp} | <strong>Total Duration:</strong> {duration_s}s | <strong>Project:</strong> <code>{project_id}</code></p>

    {'<div class="critical-banner"><h3>🚨 CRITICAL RBAC FINDINGS DETECTED</h3><p>' + str(len(critical_failures)) + ' test(s) leaked confidential data to unauthorized personas!</p></div>' if critical_failures else '<div class="clean-banner">✅ Security & Access Control: CLEAN — Zero data leaks detected across role boundaries.</div>'}

    <h2>📊 Overall Scorecard: {overall_pass_pct:.1f}% Pass Rate</h2>
    <table>
      <tr><th>Category</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Latency</th></tr>
      {''.join(f"<tr><td><code>{c}</code></td><td>{s['total']}</td><td>{s['passed']}</td><td>{s['failed']}</td><td><strong>{s['pass_pct']:.1f}%</strong></td><td>{s['avg_latency']:.1f}ms</td></tr>" for c, s in category_stats.items())}
    </table>

    <h2>🎯 Confidence Score Calibration</h2>
    <table>
      <tr><th>Confidence Tier</th><th>Count</th><th>Passed</th><th>Accuracy</th></tr>
      {''.join(f"<tr><td>{b}</td><td>{d['total']}</td><td>{d['correct']}</td><td><strong>{(d['correct']/d['total']*100 if d['total']>0 else 0):.1f}%</strong></td></tr>" for b, d in buckets.items())}
    </table>

    <h2>⚡ Latency Distribution (ms)</h2>
    <table>
      <tr><th>Intent</th><th>Count</th><th>p50</th><th>p95</th><th>Min</th><th>Max</th></tr>
      {''.join(f"<tr><td><code>{i}</code></td><td>{l['count']}</td><td>{l['p50']}ms</td><td>{l['p95']}ms</td><td>{l['min']}ms</td><td>{l['max']}ms</td></tr>" for i, l in latency_table.items())}
    </table>

    <h2>🔍 Actionable Gaps Summary</h2>
    <ul>
      {''.join(f"<li>{gp}</li>" for gp in gap_points)}
    </ul>
  </div>
</body>
</html>
"""

    os.makedirs(REPORTS_DIR, exist_ok=True)
    md_path = os.path.join(REPORTS_DIR, "benchmark_report.md")
    html_path = os.path.join(REPORTS_DIR, "benchmark_report.html")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    return md_path, html_path


if __name__ == "__main__":
    md, html = generate_benchmark_reports()
    print(f"[OK] Generated benchmark reports:\n  - Markdown: {md}\n  - HTML: {html}")
