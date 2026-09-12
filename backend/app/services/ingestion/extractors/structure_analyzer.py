"""
Structure analyzer — inspects a cloned repository directory to produce
a human-readable project structure summary including:
  - 3-level directory tree
  - Detected programming languages
  - Project type (Python / Node.js / Java / Unknown)
  - Entry point files
  - Key directories (src, tests, docs, etc.)
  - Human-readable summary string
"""
import os
import logging
from typing import Dict, List, Set

logger = logging.getLogger(__name__)

# Directories to ignore when walking or building tree
_SKIP_DIRS: Set[str] = {
    ".git", "__pycache__", "node_modules", ".env", "venv", ".venv",
    "dist", "build", ".idea", ".vscode", "coverage", ".pytest_cache",
    "htmlcov", "target", ".gradle",
}

_LANGUAGE_EXTENSIONS: Dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".scala": "Scala",
}

_KEY_DIRS: Dict[str, str] = {
    "src": "Source code",
    "lib": "Libraries/modules",
    "app": "Application code",
    "api": "API layer",
    "core": "Core logic",
    "test": "Tests",
    "tests": "Tests",
    "spec": "Tests (spec)",
    "docs": "Documentation",
    "doc": "Documentation",
    "examples": "Examples",
    "example": "Examples",
    "config": "Configuration",
    "configs": "Configuration",
    "scripts": "Scripts",
    "migrations": "Database migrations",
    "static": "Static assets",
    "public": "Public assets",
    "frontend": "Frontend code",
    "backend": "Backend code",
    "components": "UI components",
    "services": "Services layer",
    "models": "Data models",
    "utils": "Utilities",
    "helpers": "Helpers",
}

_ENTRY_POINT_FILES: List[str] = [
    "main.py", "app.py", "run.py", "server.py", "manage.py", "wsgi.py", "asgi.py",
    "index.js", "server.js", "main.js", "app.js",
    "index.ts", "main.ts", "app.ts",
    "Main.java", "Application.java",
    "main.go",
    "main.rs",
    "setup.py", "setup.cfg", "pyproject.toml",
    "package.json", "Makefile", "Dockerfile",
    "pom.xml", "build.gradle",
]


class StructureAnalyzer:
    """Analyze repository structure and produce intelligence for AI chat."""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path

    def analyze(self) -> Dict:
        """Run all analysis and return a unified structure dict."""
        languages = self._detect_languages()
        project_type = self._detect_project_type()
        entry_points = self._find_entry_points()
        key_dirs = self._identify_key_dirs()
        tree = self._build_directory_tree(self.repo_path, max_depth=3)
        summary = self._generate_summary(languages, project_type, entry_points, key_dirs)

        return {
            "structure": tree,
            "entry_points": entry_points,
            "project_type": project_type,
            "languages": list(languages),
            "key_directories": key_dirs,
            "summary": summary,
        }

    # ------------------------------------------------------------------ #
    # Private helpers                                                      #
    # ------------------------------------------------------------------ #

    def _build_directory_tree(self, path: str, max_depth: int, current_depth: int = 0) -> Dict:
        """Recursively build a trimmed directory tree."""
        tree: Dict = {}
        if current_depth >= max_depth:
            return tree

        try:
            entries = sorted(os.listdir(path))
        except PermissionError:
            return tree

        for entry in entries:
            if entry in _SKIP_DIRS or entry.startswith("."):
                continue
            full_path = os.path.join(path, entry)
            if os.path.isdir(full_path):
                tree[entry] = {
                    "type": "directory",
                    "children": self._build_directory_tree(full_path, max_depth, current_depth + 1),
                }
            else:
                ext = os.path.splitext(entry)[1]
                tree[entry] = {"type": "file", "ext": ext}

        return tree

    def _detect_languages(self) -> Set[str]:
        """Walk the repo and collect all programming languages used."""
        detected: Set[str] = set()
        for root, dirs, files in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in _SKIP_DIRS and not d.startswith(".")]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                lang = _LANGUAGE_EXTENSIONS.get(ext)
                if lang:
                    detected.add(lang)
        return detected

    def _detect_project_type(self) -> str:
        """Determine the primary project type from root-level indicator files."""
        try:
            root_files = set(os.listdir(self.repo_path))
        except Exception:
            return "Unknown"

        if "pom.xml" in root_files or "build.gradle" in root_files or "build.gradle.kts" in root_files:
            return "Java/JVM"
        if "package.json" in root_files:
            return "JavaScript/Node.js"
        if "requirements.txt" in root_files or "setup.py" in root_files or "pyproject.toml" in root_files:
            return "Python"
        if "go.mod" in root_files:
            return "Go"
        if "Cargo.toml" in root_files:
            return "Rust"
        if "Gemfile" in root_files:
            return "Ruby"
        return "Unknown"

    def _find_entry_points(self) -> List[str]:
        """Return entry point file paths that exist in the repo root."""
        entry_points: List[str] = []
        for name in _ENTRY_POINT_FILES:
            if os.path.exists(os.path.join(self.repo_path, name)):
                entry_points.append(name)
        return entry_points

    def _identify_key_dirs(self) -> Dict[str, str]:
        """Return a mapping of key directory name → description."""
        result: Dict[str, str] = {}
        try:
            entries = {e.lower(): e for e in os.listdir(self.repo_path)}
        except Exception:
            return result
        for dir_name, description in _KEY_DIRS.items():
            if dir_name in entries:
                real_name = entries[dir_name]
                full = os.path.join(self.repo_path, real_name)
                if os.path.isdir(full):
                    result[real_name] = description
        return result

    @staticmethod
    def _generate_summary(
        languages: Set[str],
        project_type: str,
        entry_points: List[str],
        key_dirs: Dict[str, str],
    ) -> str:
        lang_str = ", ".join(sorted(languages)) if languages else "unknown"
        ep_str = ", ".join(entry_points) if entry_points else "not identified"
        dirs_str = ", ".join(f"/{k}" for k in key_dirs) if key_dirs else "standard layout"
        return (
            f"Project type: {project_type}. "
            f"Languages: {lang_str}. "
            f"Entry points: {ep_str}. "
            f"Key directories: {dirs_str}."
        )
