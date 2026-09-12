"""
Java parser — regex-based extraction of public/protected methods,
full signatures, and Javadoc comments. No extra dependencies required.
"""
import re
import logging
from typing import List, Dict, Tuple

logger = logging.getLogger(__name__)


class JavaParser:
    """Extract Java methods and their signatures via regex."""

    # Matches: (visibility)? (static)? (synchronized)? (final)? returnType methodName(params)
    METHOD_PATTERN = re.compile(
        r"""
        (?:(?P<visibility>public|protected|private)\s+)?
        (?:(?P<modifiers>(?:static|synchronized|final|abstract|native)\s+){0,4})?
        (?P<return_type>[\w<>\[\].,\s]+?)\s+
        (?P<name>[a-zA-Z_]\w*)\s*
        \((?P<params>[^)]*)\)\s*
        (?:throws\s+[\w,\s]+)?\s*
        [{;]
        """,
        re.VERBOSE | re.MULTILINE,
    )

    JAVADOC_PATTERN = re.compile(r"/\*\*(.*?)\*/\s*", re.DOTALL)

    def __init__(self, file_content: str, file_path: str):
        self.file_content = file_content
        self.file_path = file_path
        self.class_name = self._extract_class_name()
        # Pre-compute Javadoc positions for lookup
        self._javadocs: List[Tuple[int, int, str]] = [
            (m.start(), m.end(), m.group(1))
            for m in self.JAVADOC_PATTERN.finditer(file_content)
        ]

    def _extract_class_name(self) -> str:
        match = re.search(r"(?:public\s+)?class\s+(\w+)", self.file_content)
        return match.group(1) if match else "Unknown"

    def _get_javadoc_before(self, position: int) -> str:
        """Return the Javadoc comment that immediately precedes `position`."""
        best = ""
        for start, end, content in self._javadocs:
            if end <= position:
                # Take the closest one before this position
                best = content
        # Clean * markers
        lines = best.split("\n")
        cleaned = [l.strip().lstrip("*").strip() for l in lines if l.strip().lstrip("*").strip()]
        return " ".join(cleaned)

    def _parse_parameters(self, params_str: str) -> List[Tuple[str, str]]:
        """Parse a Java parameter list into (type, name) pairs."""
        params_str = params_str.strip()
        if not params_str:
            return []
        result: List[Tuple[str, str]] = []
        for param in params_str.split(","):
            parts = param.strip().split()
            if len(parts) >= 2:
                # Handle annotations like @NonNull int x
                p_type = " ".join(p for p in parts[:-1] if not p.startswith("@"))
                p_name = parts[-1].rstrip(";")
                result.append((p_type, p_name))
        return result

    def _build_signature(self, return_type: str, name: str, params: List[Tuple[str, str]], modifiers: str = "") -> str:
        param_strs = [f"{pt} {pn}" for pt, pn in params]
        mod_prefix = f"{modifiers.strip()} " if modifiers and modifiers.strip() else ""
        return f"{mod_prefix}{return_type} {name}({', '.join(param_strs)})"

    def extract_methods(self) -> List[Dict]:
        """Extract all non-private methods as asset dicts."""
        assets: List[Dict] = []
        seen: set = set()

        for match in self.METHOD_PATTERN.finditer(self.file_content):
            visibility = match.group("visibility") or "package-private"
            if visibility == "private":
                continue

            method_name = match.group("name")
            return_type = match.group("return_type").strip()
            params_str = match.group("params") or ""
            modifiers = (match.group("modifiers") or "").strip()

            # Skip common false positives
            skip_names = {"if", "while", "for", "switch", "catch", "else", "new", "return", "class", "interface", "enum"}
            if method_name in skip_names:
                continue
            if return_type in skip_names:
                continue

            sig_key = f"{method_name}:{params_str}"
            if sig_key in seen:
                continue
            seen.add(sig_key)

            params = self._parse_parameters(params_str)
            signature = self._build_signature(return_type, method_name, params, modifiers)
            javadoc = self._get_javadoc_before(match.start())

            is_exported = visibility in ("public", "protected")

            assets.append({
                "asset_id": None,
                "asset_name": method_name,
                "asset_type": "method",
                "language": "java",
                "full_signature": signature,
                "docstring": javadoc,
                "reusability_score": 7.0 if is_exported else 3.0,
                "call_count": 0,
                "dependencies": [],
                "decorators": [],
                "file_path": self.file_path,
                "example_usage": f"{method_name}({', '.join(f'<{pn}>' for _, pn in params)})",
                "metadata": {
                    "visibility": visibility,
                    "is_static": "static" in (modifiers or ""),
                    "class": self.class_name,
                    "is_exported": is_exported,
                    "has_docstring": bool(javadoc),
                },
            })

        return assets
