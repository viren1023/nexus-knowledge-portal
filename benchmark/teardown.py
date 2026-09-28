"""
Teardown script for Nexus AI Benchmark Suite.
Removes all containers, networks, and persistent volumes created for the benchmark run.
Ensures zero residue left behind.
"""

import os
import sys
import subprocess
import logging
import yaml

from safety import validate_safety

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("benchmark.teardown")

BENCH_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BENCH_DIR, "config.yml")


def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}


def teardown_shadow_stack(compose_file: str = None):
    """
    Shuts down the shadow docker compose stack and wipes out all associated volumes.
    """
    if not compose_file:
        compose_file = os.path.join(BENCH_DIR, "docker-compose.bench.yml")

    if not os.path.exists(compose_file):
        logger.warning(f"Compose file {compose_file} not found; skipping docker teardown.")
        return

    logger.info(f"🧹 Tearing down shadow stack via: docker compose -f {compose_file} down -v --remove-orphans")
    try:
        res = subprocess.run(
            ["docker", "compose", "-f", compose_file, "down", "-v", "--remove-orphans"],
            cwd=BENCH_DIR,
            capture_output=True,
            text=True,
            check=True
        )
        logger.info(f"✅ Shadow stack destroyed cleanly.\n{res.stdout.strip()}")
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Failed to tear down shadow stack: {e.stderr}")
        raise e


def teardown_api_resources(base_url: str, token: str, project_id: str):
    """
    Optional API-level teardown if the project was created on an existing stack.
    """
    import urllib.request
    import json

    logger.info(f"Deleting benchmark project {project_id} via API...")
    url = f"{base_url}/api/projects/{project_id}"
    req = urllib.request.Request(url, method="DELETE", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req) as resp:
            logger.info(f"✅ Project deleted via API: {resp.status}")
    except Exception as e:
        logger.warning(f"Could not delete project via API: {e}")


def main():
    config = load_config()
    validate_safety(config)
    
    compose_file = config.get("target", {}).get("compose_file")
    if compose_file:
        compose_path = os.path.abspath(os.path.join(os.path.dirname(BENCH_DIR), compose_file)) if not os.path.isabs(compose_file) else compose_file
    else:
        compose_path = os.path.join(BENCH_DIR, "docker-compose.bench.yml")

    teardown_shadow_stack(compose_path)

    seed_state_path = os.path.join(BENCH_DIR, "seed_state.json")
    if os.path.exists(seed_state_path):
        os.remove(seed_state_path)
        logger.info(f"🗑️ Removed runtime seed state {seed_state_path}")

    logger.info("🎉 Benchmark teardown complete. Zero trace remaining.")


if __name__ == "__main__":
    main()
