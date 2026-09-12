"""
README extractor — finds, reads, and section-chunks README files for
embedding and AI chat context retrieval.
"""
import os
import re
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

_README_NAMES = [
    "README.md", "README.txt", "readme.md", "README.rst", "README",
    "Readme.md", "readme.txt",
]

_CHUNK_SIZE = 800  # characters per chunk target


class ReadmeExtractor:
    """Find and chunk README content into searchable sections."""

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def extract_readme(self, repo_path: str) -> Optional[str]:
        """Return raw README content, or None if not found."""
        for name in _README_NAMES:
            path = os.path.join(repo_path, name)
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    logger.info(f"Found README at {path} ({len(content)} chars)")
                    return content
                except Exception as e:
                    logger.warning(f"Could not read {path}: {e}")
        return None

    def extract_project_description(self, readme_content: str) -> str:
        """
        Extract a concise project description from the README.
        Returns the first meaningful paragraph (before the first header or
        after the main title if present).
        """
        lines = readme_content.split("\n")
        description_lines: List[str] = []
        skipped_title = False

        for line in lines:
            stripped = line.strip()

            # Skip the first H1 (project title) — keep text after it
            if stripped.startswith("# ") and not skipped_title:
                skipped_title = True
                continue

            # Stop at the next header or horizontal rule
            if stripped.startswith(("##", "---", "===", "***")) and description_lines:
                break

            if stripped:
                description_lines.append(stripped)
            elif description_lines:
                # First blank line after content → end of first paragraph
                break

            if len(description_lines) >= 8:
                break

        return " ".join(description_lines).strip()

    def chunk_readme(self, readme_content: str) -> List[Dict]:
        """
        Split README into section-aware chunks suitable for embedding.

        Each chunk is:
        {
            chunk_order: int,
            chunk_path: str,   # section heading or "Introduction"
            content: str,
            source_type: "readme",
            metadata: { section: str }
        }
        """
        chunks: List[Dict] = []
        chunk_order = 0

        # Split content into (heading, body) pairs using header regex
        # Matches ## Heading, ### Sub-heading, etc.
        sections = re.split(r"\n(#{1,6}\s+[^\n]+)", readme_content)

        current_heading = "Introduction"
        current_body = ""

        for part in sections:
            if re.match(r"#{1,6}\s+", part):
                # Flush previous section
                if current_body.strip():
                    for chunk in self._split_large_section(
                        current_heading, current_body.strip(), chunk_order
                    ):
                        chunks.append(chunk)
                        chunk_order += 1
                current_heading = part.lstrip("#").strip()
                current_body = ""
            else:
                current_body += part

        # Flush last section
        if current_body.strip():
            for chunk in self._split_large_section(
                current_heading, current_body.strip(), chunk_order
            ):
                chunks.append(chunk)
                chunk_order += 1

        logger.info(f"README chunked into {len(chunks)} sections")
        return chunks

    # ------------------------------------------------------------------ #
    # Private helpers                                                      #
    # ------------------------------------------------------------------ #

    def _split_large_section(
        self, heading: str, body: str, start_order: int
    ) -> List[Dict]:
        """If a section body exceeds CHUNK_SIZE, split it into sub-chunks."""
        result: List[Dict] = []
        if len(body) <= _CHUNK_SIZE:
            result.append(self._make_chunk(heading, body, start_order + len(result)))
            return result

        # Split by paragraphs
        paragraphs = re.split(r"\n{2,}", body)
        current = ""
        sub_idx = 0
        for para in paragraphs:
            if len(current) + len(para) > _CHUNK_SIZE and current:
                result.append(
                    self._make_chunk(
                        f"{heading} ({sub_idx + 1})",
                        current.strip(),
                        start_order + len(result),
                    )
                )
                sub_idx += 1
                current = para
            else:
                current += ("\n\n" if current else "") + para

        if current.strip():
            result.append(
                self._make_chunk(
                    f"{heading} ({sub_idx + 1})" if sub_idx > 0 else heading,
                    current.strip(),
                    start_order + len(result),
                )
            )
        return result

    @staticmethod
    def _make_chunk(heading: str, content: str, order: int) -> Dict:
        return {
            "chunk_order": order,
            "chunk_path": heading,
            "content": f"## {heading}\n\n{content}",
            "source_type": "readme",
            "metadata": {"section": heading},
        }
