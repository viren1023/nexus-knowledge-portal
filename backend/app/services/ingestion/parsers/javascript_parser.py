"""
JavaScript / TypeScript parser — regex-based extraction of exported functions,
arrow functions, function expressions, and JSDoc comments.
Works on .js, .jsx, .ts, .tsx files without any extra dependencies.
"""
import re
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Detect TypeScript type annotations in parameters  e.g. (x: number, y: string)
_TS_PARAM = re.compile(r"(\w+)\s*(?::\s*[\w<>\[\]|&.,\s]+)?(?:\s*=\s*[^,)]+)?")


class JavaScriptParser:
    """Extract JS/TS functions and their signatures."""

    # Pattern 1 — named function declaration
    # [export] [default] [async] function name(params)
    FUNC_DECL = re.compile(
        r"(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+(\w+)\s*\(([^)]*)\)",
        re.MULTILINE,
    )

    # Pattern 2 — arrow / function expression assigned to const/let/var
    # [export] const|let|var name = [async] (params) =>
    # [export] const|let|var name = [async] function(params)
    ARROW_OR_EXPR = re.compile(
        r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(([^)]*)\)\s*=>|function\s*\*?\s*\(([^)]*)\))",
        re.MULTILINE,
    )

    # Pattern 3 — class method (TypeScript / ES2015)
    # [public|private|protected] [static] [async] methodName(params)
    CLASS_METHOD = re.compile(
        r"(?:(?:public|private|protected|static|abstract|override|async|readonly)\s+){0,5}(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>\[\]|&.]+)?\s*\{",
        re.MULTILINE,
    )

    # JSDoc: /** ... */ immediately before the function
    JSDOC = re.compile(r"/\*\*(.*?)\*/\s*", re.DOTALL)

    def __init__(self, file_content: str, file_path: str):
        self.file_content = file_content
        self.file_path = file_path
        self.exports = self._collect_exports()
        self._jsdocs: List[Tuple[int, int, str]] = [
            (m.start(), m.end(), m.group(1))
            for m in self.JSDOC.finditer(file_content)
        ]
        # Detect TypeScript
        self.is_typescript = file_path.endswith((".ts", ".tsx"))

    def _collect_exports(self) -> set:
        """Gather all explicitly exported names."""
        exports: set = set()
        # export function / export const / export default
        exports.update(re.findall(r"export\s+(?:async\s+)?function\s+(\w+)", self.file_content))
        exports.update(re.findall(r"export\s+(?:const|let|var)\s+(\w+)", self.file_content))
        exports.update(re.findall(r"export\s+default\s+(?:async\s+)?function\s+(\w+)", self.file_content))
        # export { foo, bar as Baz }
        for grp in re.findall(r"export\s*\{([^}]+)\}", self.file_content):
            for part in grp.split(","):
                name = part.strip().split()[0]  # handle 'foo as Bar'
                exports.add(name)
        return exports

    def _get_jsdoc_before(self, position: int) -> str:
        """Return the JSDoc that immediately precedes `position`."""
        best = ""
        for start, end, content in self._jsdocs:
            if end <= position:
                best = content
        lines = best.split("\n")
        cleaned = [l.strip().lstrip("*").strip() for l in lines if l.strip().lstrip("*").strip()]
        return " ".join(cleaned)

    def _clean_params(self, params_str: str) -> str:
        """Return a cleaned, readable parameter string."""
        if not params_str:
            return ""
        # Remove default values for display brevity, keep type annotations for TS
        return params_str.strip()

    def _build_signature(self, name: str, params_str: str, is_async: bool = False) -> str:
        prefix = "async function" if is_async else "function"
        return f"{prefix} {name}({self._clean_params(params_str)})"

    def _build_example_usage(self, name: str, params_str: str) -> str:
        if not params_str or not params_str.strip():
            return f"{name}()"
        args = []
        for p in params_str.split(","):
            p_clean = p.strip()
            if p_clean:
                param_name = p_clean.split(":")[0].strip().split("=")[0].strip()
                if param_name:
                    args.append(f"<{param_name}>")
        return f"{name}({', '.join(args)})"

    def _should_skip(self, name: str) -> bool:
        skip = {
            "if", "for", "while", "switch", "catch", "constructor", "return",
            "class", "interface", "type", "enum", "import", "require",
        }
        return name in skip

    def extract_functions(self) -> List[Dict]:
        """Return asset dicts for all relevant functions/methods in this file."""
        seen: Dict[str, Dict] = {}

        # Pass 1 — named function declarations
        for m in self.FUNC_DECL.finditer(self.file_content):
            name, params_str = m.group(1), m.group(2) or ""
            if self._should_skip(name):
                continue
            is_async = "async" in self.file_content[max(0, m.start()-10):m.start()]
            jsdoc = self._get_jsdoc_before(m.start())
            if name not in seen:
                seen[name] = {
                    "params": params_str,
                    "jsdoc": jsdoc,
                    "is_async": is_async,
                    "position": m.start(),
                }

        # Pass 2 — arrow / function expressions
        for m in self.ARROW_OR_EXPR.finditer(self.file_content):
            name = m.group(1)
            params_str = (m.group(2) or m.group(3) or "").strip()
            if self._should_skip(name):
                continue
            is_async = "async" in self.file_content[max(0, m.start()-5):m.start()+40]
            jsdoc = self._get_jsdoc_before(m.start())
            if name not in seen:
                seen[name] = {
                    "params": params_str,
                    "jsdoc": jsdoc,
                    "is_async": is_async,
                    "position": m.start(),
                }

        assets: List[Dict] = []
        lang = "typescript" if self.is_typescript else "javascript"

        for name, info in seen.items():
            params_str = info["params"]
            is_exported = name in self.exports
            is_async = info["is_async"]
            jsdoc = info["jsdoc"]

            # Skip truly private (underscore-prefixed non-exports)
            if name.startswith("_") and not is_exported:
                continue

            signature = self._build_signature(name, params_str, is_async)

            assets.append({
                "asset_id": None,
                "asset_name": name,
                "asset_type": "function",
                "language": lang,
                "full_signature": signature,
                "docstring": jsdoc,
                "reusability_score": 8.0 if is_exported else 4.0,
                "call_count": 0,
                "dependencies": [],
                "decorators": [],
                "file_path": self.file_path,
                "example_usage": self._build_example_usage(name, params_str),
                "metadata": {
                    "is_exported": is_exported,
                    "is_async": is_async,
                    "has_docstring": bool(jsdoc),
                    "is_typescript": self.is_typescript,
                },
            })

        return assets
