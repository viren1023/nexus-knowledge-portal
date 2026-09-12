"""
Enhanced Git Analyzer — production-grade coordinator for repository intelligence.

Replaces the previous flat analyze_git_repo() function with a class-based
approach that:
  1. Clones the repository
  2. Runs StructureAnalyzer (languages, entry points, project type)
  3. Runs ReadmeExtractor (description + section chunks)
  4. Dispatches to PythonParser / JavaParser / JavaScriptParser
  5. Returns assets + readme_chunks + project_metadata

The legacy analyze_git_repo() thin wrapper is kept so worker.py continues
to work without changes until it is updated in the same session.
"""

import os
import shutil
import logging
from git import Repo
from typing import List, Dict, Tuple, Any

from .parsers.python_parser import PythonParser
from .parsers.java_parser import JavaParser
from .parsers.javascript_parser import JavaScriptParser
from .extractors.readme_extractor import ReadmeExtractor
from .extractors.structure_analyzer import StructureAnalyzer

logger = logging.getLogger(__name__)

# File extensions to skip (binary / generated / large)
_SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
    ".lock", ".bin", ".exe", ".dll", ".so", ".dylib",
    ".pyc", ".class", ".jar", ".war",
    ".mp4", ".mp3", ".wav", ".avi",
    ".woff", ".woff2", ".ttf", ".eot",
    ".min.js",  # will also check str.endswith
}

_MAX_FILE_SIZE_BYTES = 500_000  # skip files larger than 500 KB


class EnhancedGitAnalyzer:
    """Full intelligence extraction from a git repository."""

    def __init__(self, repo_url: str, repo_id: str, project_id: str):
        self.repo_url = repo_url
        self.repo_id = repo_id
        self.project_id = project_id
        self.repos_dir = os.path.join(os.getcwd(), "uploads", "repos")
        self.local_dir = os.path.join(self.repos_dir, str(repo_id))

    # ------------------------------------------------------------------ #
    # Public                                                               #
    # ------------------------------------------------------------------ #

    def analyze(self) -> Dict[str, Any]:
        """
        Full analysis pipeline.

        Returns:
        {
            "assets": List[Dict],          # extracted functions/methods
            "readme_chunks": List[Dict],   # README sections for embedding
            "project_metadata": Dict,      # structure analysis + description
            "local_dir": str               # absolute path to cloned repo
        }
        """
        self._prepare_repo()

        # Step 1 — Project structure
        structure_analyzer = StructureAnalyzer(self.local_dir)
        project_metadata = structure_analyzer.analyze()
        logger.info(
            f"Structure analysis done: type={project_metadata['project_type']}, "
            f"languages={project_metadata['languages']}"
        )

        # Step 2 — README
        readme_extractor = ReadmeExtractor()
        readme_content = readme_extractor.extract_readme(self.local_dir)
        readme_chunks: List[Dict] = []
        description: str = ""

        if readme_content:
            readme_chunks = readme_extractor.chunk_readme(readme_content)
            description = readme_extractor.extract_project_description(readme_content)
            logger.info(f"README: {len(readme_chunks)} chunks extracted")
        else:
            logger.info("No README found in repository")

        # Step 3 — Code assets
        detected_languages = set(project_metadata.get("languages", []))
        assets = self._extract_code_assets(detected_languages)
        logger.info(f"Code assets extracted: {len(assets)}")

        return {
            "assets": assets,
            "readme_chunks": readme_chunks,
            "project_metadata": {
                **project_metadata,
                "description": description,
            },
            "local_dir": self.local_dir,
        }

    # ------------------------------------------------------------------ #
    # Private                                                              #
    # ------------------------------------------------------------------ #

    def _prepare_repo(self):
        """Clone (or re-clone) the repository to the local directory."""
        os.makedirs(self.repos_dir, exist_ok=True)
        if os.path.exists(self.local_dir):
            shutil.rmtree(self.local_dir)
        try:
            logger.info(f"Cloning {self.repo_url} → {self.local_dir}")
            Repo.clone_from(self.repo_url, self.local_dir)
        except Exception as e:
            raise RuntimeError(f"Failed to clone repo {self.repo_url}: {e}") from e

    def _should_skip_file(self, file_name: str, file_path: str) -> bool:
        """Return True if this file should be skipped."""
        lower = file_name.lower()
        for ext in _SKIP_EXTENSIONS:
            if lower.endswith(ext):
                return True
        try:
            if os.path.getsize(file_path) > _MAX_FILE_SIZE_BYTES:
                return True
        except OSError:
            return True
        return False

    def _extract_code_assets(self, languages: set) -> List[Dict]:
        """Walk repo and dispatch to appropriate parsers based on file extension."""
        assets: List[Dict] = []

        for root, dirs, files in os.walk(self.local_dir):
            # Prune directories in-place
            dirs[:] = [
                d for d in dirs
                if not d.startswith(".")
                and d not in {
                    "node_modules", "__pycache__", "venv", ".venv",
                    "dist", "build", "target", ".gradle",
                }
            ]

            for file_name in files:
                file_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(file_path, self.local_dir)

                if self._should_skip_file(file_name, file_path):
                    continue

                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                    # Python
                    if file_name.endswith(".py"):
                        parser = PythonParser(content, rel_path)
                        assets.extend(parser.extract_functions())

                    # Java / Kotlin (Kotlin uses same file structure; regex still helps)
                    elif file_name.endswith((".java", ".kt")):
                        parser = JavaParser(content, rel_path)
                        assets.extend(parser.extract_methods())

                    # JavaScript / TypeScript
                    elif file_name.endswith((".js", ".jsx", ".ts", ".tsx")):
                        parser = JavaScriptParser(content, rel_path)
                        assets.extend(parser.extract_functions())

                except Exception as e:
                    logger.warning(f"Could not parse {rel_path}: {e}")

        return assets


# ---------------------------------------------------------------------------
# Legacy thin wrapper — keeps worker.py working without modification
# ---------------------------------------------------------------------------

def analyze_git_repo(
    repo_url: str,
    role_access: str,
    repo_id: str,
) -> Tuple[List[Dict], str]:
    """
    Thin wrapper around EnhancedGitAnalyzer for backward compatibility.

    Returns (assets, local_dir) — the same signature as the old function.
    The additional fields (readme_chunks, project_metadata) are available
    via EnhancedGitAnalyzer.analyze() when called directly from worker.py.
    """
    analyzer = EnhancedGitAnalyzer(
        repo_url=repo_url,
        repo_id=repo_id,
        project_id="",  # role_access handled by caller
    )
    result = analyzer.analyze()
    return result["assets"], result["local_dir"]
