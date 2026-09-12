"""
Enhanced Python parser — extracts full type-annotated signatures,
call counts, dependency graphs, and decorators using Python's ast module.
"""
import ast
import logging
from typing import List, Dict, Optional, Union

logger = logging.getLogger(__name__)


class PythonParser:
    """Extract functions with full signatures, types, call counts and dependencies."""

    def __init__(self, file_content: str, file_path: str):
        self.file_content = file_content
        self.file_path = file_path
        self.tree: Optional[ast.AST] = None
        self.imports: Dict[str, str] = {}
        self.all_functions: Dict[str, str] = {}

        try:
            self.tree = ast.parse(file_content)
            self.imports = self._extract_imports()
            self.all_functions = self._collect_all_functions()
        except SyntaxError as e:
            logger.warning(f"SyntaxError parsing {file_path}: {e}")

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _extract_imports(self) -> Dict[str, str]:
        """Extract all imports so we can understand external dependencies."""
        imports: Dict[str, str] = {}
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    key = alias.asname or alias.name
                    imports[key] = alias.name
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for alias in node.names:
                    key = alias.asname or alias.name
                    imports[key] = f"{module}.{alias.name}"
        return imports

    def _collect_all_functions(self) -> Dict[str, str]:
        """Collect all function names defined in this file (for call analysis)."""
        functions: Dict[str, str] = {}
        for node in ast.walk(self.tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                functions[node.name] = node.name
        return functions

    def _annotation_to_str(self, annotation) -> str:
        """Convert an AST annotation node to a readable string."""
        if annotation is None:
            return ""
        if isinstance(annotation, ast.Name):
            return annotation.id
        if isinstance(annotation, ast.Constant):
            return repr(annotation.value)
        if isinstance(annotation, ast.Attribute):
            return f"{self._annotation_to_str(annotation.value)}.{annotation.attr}"
        if isinstance(annotation, ast.Subscript):
            val = self._annotation_to_str(annotation.value)
            slc = self._annotation_to_str(annotation.slice)
            return f"{val}[{slc}]"
        if isinstance(annotation, ast.Tuple):
            parts = [self._annotation_to_str(e) for e in annotation.elts]
            return ", ".join(parts)
        if isinstance(annotation, ast.BinOp) and isinstance(annotation.op, ast.BitOr):
            # Python 3.10+ union: X | Y
            return f"{self._annotation_to_str(annotation.left)} | {self._annotation_to_str(annotation.right)}"
        return "Any"

    def _extract_full_signature(self, node: Union[ast.FunctionDef, ast.AsyncFunctionDef]) -> str:
        """Build the full type-annotated signature string."""
        args = node.args
        arg_strs: List[str] = []

        # Positional-only args (Python 3.8+)
        for i, arg in enumerate(args.posonlyargs):
            if arg.annotation:
                arg_strs.append(f"{arg.arg}: {self._annotation_to_str(arg.annotation)}")
            else:
                arg_strs.append(arg.arg)
        if args.posonlyargs:
            arg_strs.append("/")

        # Regular args (with defaults counted from the end)
        defaults_offset = len(args.args) - len(args.defaults)
        for i, arg in enumerate(args.args):
            part = arg.arg
            if arg.annotation:
                part += f": {self._annotation_to_str(arg.annotation)}"
            default_index = i - defaults_offset
            if default_index >= 0:
                default_node = args.defaults[default_index]
                part += f" = {ast.unparse(default_node)}"
            arg_strs.append(part)

        # *args
        if args.vararg:
            vararg = f"*{args.vararg.arg}"
            if args.vararg.annotation:
                vararg += f": {self._annotation_to_str(args.vararg.annotation)}"
            arg_strs.append(vararg)
        elif args.kwonlyargs:
            arg_strs.append("*")

        # Keyword-only args
        kw_defaults = {k: v for k, v in zip(args.kwonlyargs, args.kw_defaults) if v is not None}
        for arg in args.kwonlyargs:
            part = arg.arg
            if arg.annotation:
                part += f": {self._annotation_to_str(arg.annotation)}"
            if arg in kw_defaults:
                part += f" = {ast.unparse(kw_defaults[arg])}"
            arg_strs.append(part)

        # **kwargs
        if args.kwarg:
            kwarg = f"**{args.kwarg.arg}"
            if args.kwarg.annotation:
                kwarg += f": {self._annotation_to_str(args.kwarg.annotation)}"
            arg_strs.append(kwarg)

        args_str = ", ".join(arg_strs)
        return_str = ""
        if node.returns:
            return_str = f" -> {self._annotation_to_str(node.returns)}"

        prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
        return f"{prefix} {node.name}({args_str}){return_str}:"

    def _extract_decorators(self, node: Union[ast.FunctionDef, ast.AsyncFunctionDef]) -> List[str]:
        """Extract decorator strings."""
        decorators: List[str] = []
        for dec in node.decorator_list:
            if isinstance(dec, ast.Name):
                decorators.append(f"@{dec.id}")
            elif isinstance(dec, ast.Attribute):
                decorators.append(f"@{self._annotation_to_str(dec)}")
            elif isinstance(dec, ast.Call):
                func = dec.func
                if isinstance(func, ast.Name):
                    decorators.append(f"@{func.id}(...)")
                elif isinstance(func, ast.Attribute):
                    decorators.append(f"@{self._annotation_to_str(func)}(...)")
            else:
                decorators.append("@<decorator>")
        return decorators

    def _extract_dependencies(self, node: Union[ast.FunctionDef, ast.AsyncFunctionDef]) -> List[str]:
        """Find names of other local functions called within this function body."""
        deps: List[str] = []
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call):
                if isinstance(sub.func, ast.Name):
                    name = sub.func.id
                    if name in self.all_functions and name != node.name:
                        deps.append(name)
                elif isinstance(sub.func, ast.Attribute):
                    # e.g. self.helper() — record the method name
                    deps.append(sub.func.attr)
        return list(set(deps))

    def _count_function_calls(self, func_name: str) -> int:
        """Count how many times func_name is called in the entire file."""
        count = 0
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id == func_name:
                    count += 1
                elif isinstance(node.func, ast.Attribute) and node.func.attr == func_name:
                    count += 1
        return count

    def _extract_example_usage(
        self,
        node: Union[ast.FunctionDef, ast.AsyncFunctionDef],
        docstring: Optional[str],
    ) -> str:
        """Build a simple example usage string from docstring or arg names."""
        if docstring:
            lines = docstring.split("\n")
            examples: List[str] = []
            in_example = False
            for line in lines:
                if ">>>" in line or "example:" in line.lower():
                    in_example = True
                if in_example:
                    examples.append(line)
                    if examples and line.strip() == "":
                        break
            if examples:
                return "\n".join(examples)

        # Construct a minimal call example
        call_args: List[str] = []
        for arg in node.args.args:
            if arg.arg == "self":
                continue
            call_args.append(f"<{arg.arg}>")
        return f"{node.name}({', '.join(call_args)})"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract_functions(self) -> List[Dict]:
        """Return a list of asset dicts for all functions/methods in this file."""
        if self.tree is None:
            return []

        assets: List[Dict] = []

        for node in ast.walk(self.tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue

            docstring = ast.get_docstring(node)
            is_exported = not node.name.startswith("_")
            has_docstring = docstring is not None
            call_count = self._count_function_calls(node.name)
            decorators = self._extract_decorators(node)
            dependencies = self._extract_dependencies(node)
            full_sig = self._extract_full_signature(node)
            example = self._extract_example_usage(node, docstring)

            # Reusability scoring (0–10)
            score = (
                min(call_count / 10, 1.0) * 0.4
                + (1 if is_exported else 0) * 0.3
                + (1 if has_docstring else 0) * 0.2
                + min(len(dependencies) / 10, 1.0) * 0.1
            )

            assets.append({
                "asset_id": None,  # assigned by DB
                "asset_name": node.name,
                "asset_type": "function",
                "language": "python",
                "full_signature": full_sig,
                "docstring": docstring or "",
                "reusability_score": round(min(10.0, score * 10), 2),
                "call_count": call_count,
                "dependencies": dependencies,
                "decorators": decorators,
                "file_path": self.file_path,
                "example_usage": example,
                "metadata": {
                    "is_exported": is_exported,
                    "has_docstring": has_docstring,
                    "has_decorators": bool(decorators),
                    "is_async": isinstance(node, ast.AsyncFunctionDef),
                },
            })

        return assets
