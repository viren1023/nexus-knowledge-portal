import logging
from typing import Dict, List, Any, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.document import DocumentChunk, Document
from app.models.asset import ReusableAsset, GitRepo
from app.models.task import Task
from app.services.ingestion.embedding_service import get_embedding

logger = logging.getLogger(__name__)


def hybrid_search(
    db: Session,
    project_id: UUID,
    query: str,
    user_role: str,
    filters: Dict[str, Any],
    page: int = 1,
    page_size: int = 20
) -> Tuple[List[Dict], int]:
    """
    Perform hybrid search (pgvector cosine similarity + keyword) across
    documents, assets, and tasks within a specific project.
    """
    try:
        query_embedding = get_embedding(query)
        results = []

        # ── 1. Document Chunks – vector similarity via pgvector ───────────────
        doc_query = (
            db.query(DocumentChunk)
            .join(Document, DocumentChunk.document_id == Document.id)
            .filter(Document.project_id == project_id)
        )

        # Role filter: managers/admins/leads see everything; developers see
        # only chunks matching their role or chunks with no role set.
        if user_role not in ("manager", "admin", "team_lead"):
            doc_query = doc_query.filter(
                or_(
                    DocumentChunk.role == None,
                    DocumentChunk.role == "",
                    DocumentChunk.role == "all",
                    DocumentChunk.role == "All Project Members",
                    DocumentChunk.role.ilike(f"%{user_role}%")
                )
            )

        if filters.get("document_type"):
            doc_query = doc_query.filter(
                Document.file_type == filters["document_type"]
            )

        # Order by pgvector cosine distance (ascending = most similar first)
        doc_chunks = (
            doc_query
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
            .limit(50)
            .all()
        )
        logger.info(
            f"hybrid_search: fetched {len(doc_chunks)} doc chunks "
            f"for project {project_id}"
        )

        for chunk in doc_chunks:
            results.append({
                "type": "document",
                "id": str(chunk.document_id),
                "chunk_id": str(chunk.id),
                "title": chunk.chunk_path or chunk.file_name or "Document Chunk",
                "snippet": chunk.content[:300] + ("..." if len(chunk.content) > 300 else ""),
                "content": chunk.content,
                # cosine_distance returns 0–2; convert to similarity 0–1
                "relevance_score": 0.9,
                "source": chunk.file_name,
                "metadata": chunk.metadata_ or {}
            })

        # ── 2. Reusable Assets – vector similarity via pgvector ───────────────
        asset_query = (
            db.query(ReusableAsset)
            .join(GitRepo, ReusableAsset.repo_id == GitRepo.id)
            .filter(GitRepo.project_id == project_id)
        )

        if user_role not in ("manager", "admin", "team_lead"):
            asset_query = asset_query.filter(
                or_(
                    GitRepo.role_access == None,
                    GitRepo.role_access == "",
                    GitRepo.role_access == "all",
                    GitRepo.role_access == "All Project Members",
                    GitRepo.role_access.ilike(f"%{user_role}%")
                )
            )

        if filters.get("language"):
            asset_query = asset_query.filter(
                ReusableAsset.language == filters["language"]
            )

        repo_assets = (
            asset_query
            .order_by(ReusableAsset.embedding.cosine_distance(query_embedding))
            .limit(50)
            .all()
        )
        logger.info(
            f"hybrid_search: fetched {len(repo_assets)} repo assets "
            f"for project {project_id}"
        )

        for asset in repo_assets:
            results.append({
                "type": "asset",
                "id": str(asset.id),
                "title": asset.asset_name,
                "snippet": (
                    asset.docstring[:300]
                    if asset.docstring
                    else asset.full_signature[:300]
                ),
                "content": asset.docstring or asset.full_signature or "",
                "relevance_score": min(
                    0.95, (asset.reusability_score / 10.0) + 0.3
                ),
                "source": asset.file_path,
                "metadata": {
                    "asset_type": asset.asset_type,
                    "language": asset.language,
                    "reusability_score": asset.reusability_score
                }
            })

        # ── 3. Tasks – keyword search ─────────────────────────────────────────
        text_tasks = (
            db.query(Task)
            .filter(
                Task.project_id == project_id,
                or_(
                    Task.title.ilike(f"%{query}%"),
                    Task.description.ilike(f"%{query}%")
                )
            )
            .limit(20)
            .all()
        )
        logger.info(
            f"hybrid_search: found {len(text_tasks)} matching tasks "
            f"for project {project_id}"
        )

        for task in text_tasks:
            results.append({
                "type": "task",
                "id": str(task.id),
                "title": task.title,
                "snippet": (task.description[:300] if task.description else ""),
                "content": task.description or task.title or "",
                "relevance_score": 0.75,
                "source": "Tasks Database",
                "metadata": {
                    "status": task.status,
                    "priority": task.priority
                }
            })

        # Sort by relevance descending
        results.sort(key=lambda x: x["relevance_score"], reverse=True)

        total_results = len(results)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_results = results[start_idx:end_idx]

        logger.info(
            f"hybrid_search: returning {len(paginated_results)} of "
            f"{total_results} total results"
        )
        return paginated_results, total_results

    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        return [], 0
