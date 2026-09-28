"""
Safety Guardrails for Nexus AI Benchmark Suite.
Prevents accidental execution against production or default development stacks.
"""

import sys
import logging
from urllib.parse import urlparse

logger = logging.getLogger("benchmark.safety")

class SecurityException(Exception):
    """Raised when benchmark targets an unsafe or production-looking endpoint."""
    pass


def validate_safety(config: dict, force: bool = False):
    """
    Validate target base_url and db_url against strict isolation rules.
    Hard-fails if any production/dev collision is detected.
    """
    if force:
        logger.warning("[SAFETY OVERRIDE] Safety checks bypassed via --force flag.")
        return

    safety_rules = config.get("safety", {})
    target = config.get("target", {})
    
    base_url = target.get("base_url", "")
    db_url = target.get("db_url", "")
    
    forbidden_ports = set(safety_rules.get("forbidden_ports", [5432, 5433, 8000, 6379]))
    forbidden_db_names = set(safety_rules.get("forbidden_db_names", ["knowledge_portal", "prod"]))
    allowed_db_substrings = safety_rules.get("allowed_db_substrings", ["bench", "test"])

    # 1. Validate Base HTTP URL
    if base_url:
        parsed_url = urlparse(base_url)
        port = parsed_url.port or (443 if parsed_url.scheme == 'https' else 80)
        
        if port in forbidden_ports:
            raise SecurityException(
                f"\n❌ [CRITICAL SAFETY VIOLATION] Target URL {base_url} is using port {port}, "
                f"which matches the production/dev stack port!\n"
                f"Benchmark MUST run on isolated shadow stack (e.g. port 8005).\n"
                f"Aborting benchmark immediately to protect real data."
            )
            
        if "localhost:8000" in base_url or "127.0.0.1:8000" in base_url:
            raise SecurityException(
                f"\n❌ [CRITICAL SAFETY VIOLATION] Target URL points to default development backend (port 8000).\n"
                f"Target must be shadow stack backend on port 8005."
            )

    # 2. Validate DB URL if specified
    if db_url:
        parsed_db = urlparse(db_url)
        db_port = parsed_db.port
        db_name = (parsed_db.path or "").lstrip("/")

        if db_port in forbidden_ports:
            raise SecurityException(
                f"\n❌ [CRITICAL SAFETY VIOLATION] Target DB URL uses port {db_port}, "
                f"which matches a primary database port! Shadow stack must use isolated port (e.g. 5435)."
            )

        if db_name in forbidden_db_names:
            raise SecurityException(
                f"\n❌ [CRITICAL SAFETY VIOLATION] Database name '{db_name}' is in forbidden production DB list!\n"
                f"Benchmark database name must contain 'bench' or 'test'."
            )

        if not any(sub in db_name.lower() for sub in allowed_db_substrings):
            raise SecurityException(
                f"\n❌ [CRITICAL SAFETY VIOLATION] Database name '{db_name}' does not contain an approved "
                f"isolation marker ('bench' or 'test'). Refusing to proceed."
            )

    logger.info("✅ Safety check passed: target environment is verified as an isolated benchmark stack.")
