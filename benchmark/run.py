"""
Master Orchestrator for Nexus AI Benchmark Suite.
Coordinates shadow stack startup, environment seeding, fixture evaluation,
automated grading, report generation, and self-erasing teardown.

Usage:
    python benchmark/run.py
    python benchmark/run.py --keep              # Preserve shadow stack for debugging
    python benchmark/run.py --no-stack          # Assume shadow stack is already running
    python benchmark/run.py --category access_control # Run single category
    python benchmark/run.py --dry-run
"""

import os
import sys
import time
import argparse
import subprocess
import logging
import urllib.request
import yaml

from safety import validate_safety
from seed import seed_benchmark_environment
from run_benchmark import run_benchmark
from report import generate_benchmark_reports
from teardown import teardown_shadow_stack

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("benchmark.orchestrator")

BENCH_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BENCH_DIR, "config.yml")
COMPOSE_PATH = os.path.join(BENCH_DIR, "docker-compose.bench.yml")


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def wait_for_backend(base_url: str, timeout: int = 60) -> bool:
    """Poll health endpoint until shadow stack backend is ready."""
    logger.info(f"⏳ Waiting for shadow backend at {base_url}/health...")
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(f"{base_url}/health")
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    logger.info("✅ Shadow backend is healthy and responding.")
                    return True
        except Exception:
            pass
        time.sleep(2)
    return False


def start_shadow_stack():
    """Start shadow stack containers in isolated network."""
    logger.info(f"🏗️ Starting isolated shadow stack via docker-compose: {COMPOSE_PATH}...")
    try:
        subprocess.run(
            ["docker", "compose", "-f", COMPOSE_PATH, "up", "-d", "--build"],
            cwd=BENCH_DIR,
            check=True
        )
        logger.info("✅ Shadow stack containers launched.")
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Failed to launch shadow stack: {e}")
        raise e


def main():
    parser = argparse.ArgumentParser(description="Nexus AI Benchmark Suite Master Runner")
    parser.add_argument("--mode", choices=["shadow", "local"], default="shadow", help="Benchmark execution mode")
    parser.add_argument("--keep", action="store_true", help="Keep shadow stack running after benchmark completes")
    parser.add_argument("--no-stack", action="store_true", help="Skip docker compose up (assume shadow stack is already running)")
    parser.add_argument("--category", type=str, default=None, help="Execute only a specific test category")
    parser.add_argument("--dry-run", action="store_true", help="Dry run without firing network calls")
    parser.add_argument("--force", action="store_true", help="Bypass safety guardrails (DANGEROUS)")
    args = parser.parse_args()

    config = load_config()
    validate_safety(config, force=args.force)

    base_url = config["target"]["base_url"]
    start_time = time.time()
    failed = False

    try:
        # Step 1: Shadow stack launch
        if args.mode == "shadow" and not args.no_stack and not args.dry_run:
            start_shadow_stack()
            if not wait_for_backend(base_url, timeout=60):
                raise TimeoutError(f"Shadow stack backend at {base_url} did not become healthy in time.")

        # Step 2: Seed environment
        if not args.dry_run:
            logger.info("\n🌱 [PHASE 1] Seeding simulated company workspace...")
            seed_state = seed_benchmark_environment(config)
            logger.info(f"✅ Seeding finished. Project ID: {seed_state['project_id']}")

        # Step 3: Run benchmark fixtures
        logger.info("\n🧪 [PHASE 2] Running data-driven benchmark test suite...")
        run_data = run_benchmark(category_filter=args.category, dry_run=args.dry_run)

        # Step 4: Generate reports
        if not args.dry_run:
            logger.info("\n📊 [PHASE 3] Generating gap-analysis reports...")
            md_path, html_path = generate_benchmark_reports()
            logger.info(f"\n🎉 Benchmark Run Complete!")
            logger.info(f"   📄 Markdown Report: {md_path}")
            logger.info(f"   🌐 HTML Report:     {html_path}")

    except Exception as e:
        logger.error(f"\n❌ Benchmark execution error: {e}", exc_info=True)
        failed = True
    finally:
        # Step 5: Teardown (self-erasing)
        if args.mode == "shadow" and not args.keep and not args.dry_run:
            logger.info("\n🧹 [PHASE 4] Self-erasing teardown: destroying shadow stack...")
            teardown_shadow_stack(COMPOSE_PATH)
        elif args.keep:
            logger.info(f"\n⚠️  [KEEP] Shadow stack kept active at {base_url} for debugging.")

    total_duration = time.time() - start_time
    logger.info(f"Total benchmark process time: {total_duration:.1f}s")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
