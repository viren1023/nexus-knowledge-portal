import logging
from typing import Dict, Any, List
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from app.services.search.hybrid_search import hybrid_search
from app.models.task import Task
from app.models.developer import Developer
from app.models.project import Project
from app.models.asset import GitRepo
from app.models.document import Document, DocumentChunk

logger = logging.getLogger(__name__)

def retrieve_context(db: Session, project_id: str, intent: str, user_message: str, user_role: str) -> Dict[str, Any]:
    """
    Retrieve context from the database based on the classified intent.
    """
    context = {
        "documents": [],
        "assets": [],
        "tasks": [],
        "projects": [],
        "raw_results": [],
        "project_overview": None,  # populated for project_overview intent
    }

    try:
        proj_id = UUID(str(project_id))

        if intent in ["knowledge_qa", "project_summary", "asset_search"]:
            results, total = hybrid_search(
                db, proj_id, user_message, user_role,
                filters={}, page=1, page_size=8
            )
            logger.info(f"retrieve_context [{intent}]: got {total} total, using {len(results)} results")
            context["raw_results"] = results
            for r in results:
                if r["type"] == "document":
                    context["documents"].append(r)
                elif r["type"] == "asset":
                    context["assets"].append(r)
                elif r["type"] == "project":
                    context["projects"].append(r)

        elif intent == "task_query":
            # For task queries, fetch ALL tasks for the project directly.
            # Keyword search against the user's question won't match task titles.
            all_tasks = (
                db.query(Task)
                .options(joinedload(Task.assignee))
                .filter(Task.project_id == proj_id)
                .order_by(Task.created_at.asc())
                .all()
            )
            logger.info(f"retrieve_context [task_query]: found {len(all_tasks)} tasks for project {proj_id}")

            task_results = []
            for task in all_tasks:
                assignee_name = task.assignee.name if task.assignee else "Unassigned"
                due = str(task.due_date) if task.due_date else "No due date"
                snippet = (
                    f"Status: {task.status or 'backlog'} | "
                    f"Priority: {task.priority or 'medium'} | "
                    f"Assigned to: {assignee_name} | "
                    f"Due: {due}\n"
                    f"{task.description or ''}"
                )
                entry = {
                    "type": "task",
                    "id": str(task.id),
                    "title": task.title,
                    "snippet": snippet,
                    "relevance_score": 1.0,
                    "source": "Tasks Database",
                    "metadata": {
                        "status": task.status,
                        "priority": task.priority,
                        "assigned_to": assignee_name,
                        "due_date": due,
                    }
                }
                task_results.append(entry)
                context["tasks"].append(entry)

            context["raw_results"] = task_results

        elif intent == "project_overview":
            # Query all git repos for this project and use their metadata + README chunks
            repos = (
                db.query(GitRepo)
                .filter(GitRepo.project_id == proj_id)
                .all()
            )
            logger.info(f"retrieve_context [project_overview]: found {len(repos)} repos for project {proj_id}")

            overview_items = []
            raw_results = []

            if not repos:
                # Fallback to project info and documents if no git repo is attached yet
                proj = db.query(Project).filter(Project.id == proj_id).first()
                if proj:
                    snippet = f"Project: {proj.name}\nDescription: {proj.description or 'No description provided.'}"
                    raw_results.append({
                        "type": "project",
                        "id": str(proj.id),
                        "title": proj.name,
                        "snippet": snippet,
                        "relevance_score": 1.0,
                        "source": "Project Info",
                        "metadata": {},
                    })
                doc_results, _ = hybrid_search(
                    db, proj_id, user_message, user_role,
                    filters={}, page=1, page_size=4
                )
                raw_results.extend(doc_results)
            else:
                for repo in repos:
                    meta = getattr(repo, "metadata_", None) or {}
                    if isinstance(meta, str):
                        import json
                        try:
                            meta = json.loads(meta)
                        except Exception:
                            meta = {}

                    structure = meta.get("structure_analysis", {})
                    description = meta.get("description", "")

                    # Fetch README chunks stored for this repo (up to 6 sections)
                    readme_chunks = (
                        db.query(DocumentChunk)
                        .filter(
                            DocumentChunk.source_type == "readme",
                            DocumentChunk.metadata_["repo_id"].astext == str(repo.id),
                        )
                        .order_by(DocumentChunk.chunk_order)
                        .limit(6)
                        .all()
                    )

                    if not readme_chunks:
                        readme_doc_ids = (
                            db.query(Document.id)
                            .filter(
                                Document.project_id == proj_id,
                                Document.metadata_["repo_id"].astext == str(repo.id),
                            )
                            .scalar_subquery()
                        )
                        readme_chunks = (
                            db.query(DocumentChunk)
                            .filter(
                                DocumentChunk.document_id.in_(readme_doc_ids),
                                DocumentChunk.source_type == "readme",
                            )
                            .order_by(DocumentChunk.chunk_order)
                            .limit(6)
                            .all()
                        )

                    readme_text = "\n\n".join(c.content for c in readme_chunks)

                    item = {
                        "repo_name": repo.repo_name,
                        "repo_url": repo.repo_url,
                        "project_type": structure.get("project_type", "Unknown"),
                        "languages": structure.get("languages", repo.languages or []),
                        "entry_points": structure.get("entry_points", []),
                        "key_directories": structure.get("key_directories", {}),
                        "structure_summary": structure.get("summary", ""),
                        "description": description,
                        "readme_excerpt": readme_text,
                    }
                    overview_items.append(item)

                    # Also add as raw_results so the response_generator can use context_str
                    snippet = (
                        f"Repository: {repo.repo_name}\n"
                        f"Type: {item['project_type']} | Languages: {', '.join(item['languages'])}\n"
                        f"Entry points: {', '.join(item['entry_points']) or 'N/A'}\n"
                        f"Key directories: {', '.join('/' + k for k in item['key_directories']) or 'N/A'}\n"
                        f"Description: {description}\n"
                        f"README:\n{readme_text[:1200]}"
                    )
                    raw_results.append({
                        "type": "project",
                        "id": str(repo.id),
                        "title": repo.repo_name,
                        "snippet": snippet,
                        "relevance_score": 1.0,
                        "source": "Repository Metadata",
                        "metadata": {},
                    })

            context["project_overview"] = overview_items
            context["raw_results"] = raw_results

        elif intent == "unknown":
            results, total = hybrid_search(
                db, proj_id, user_message, user_role,
                filters={}, page=1, page_size=5
            )
            logger.info(f"retrieve_context [unknown]: got {total} total, using {len(results)} results")
            context["raw_results"] = results

        return context
    except Exception as e:
        logger.error(f"Failed to retrieve context: {e}", exc_info=True)
        return context
