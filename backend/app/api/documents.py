from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse, Response, PlainTextResponse
import logging
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import uuid
import os
import shutil

from app.database import get_db
from app.models.document import Document, DocumentChunk
from app.models.asset import GitRepo, ReusableAsset
from app.models.project import Project
from app.services.ingestion.queue_manager import enqueue_document_processing, enqueue_repo_processing, get_job_status
from app.api.projects import check_project_membership
from app.utils.roles import has_permission
from pydantic import BaseModel

def check_asset_access(user_role: str, role_access: str) -> bool:
    if not role_access or role_access.lower() == "all" or role_access.lower() == "all project members":
        return True
    allowed_roles = [r.strip().lower() for r in role_access.split(',')]
    return user_role.lower() in allowed_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Documents & Repos"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class GitRepoUpload(BaseModel):
    repo_url: str
    repo_name: str
    role_access: str

def get_file_type(file_name: str) -> str:
    ext = os.path.splitext(file_name or "")[1].lower().lstrip(".")
    if ext in {"pdf", "doc", "docx", "md", "markdown", "txt", "png", "jpg", "jpeg"}:
        return ext
    return ext or "unknown"

@router.post("/documents/upload")
async def upload_document(
    project_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    role_access: str = Form(...),
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "You are not a member of this project"}, status_code=403)
        
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return JSONResponse({"error": "Project not found"}, status_code=404)
        
    try:
        document_id = uuid.uuid4()
        file_path = os.path.join(UPLOAD_DIR, f"{document_id}_{file.filename}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        doc = Document(
            id=document_id,
            project_id=project_id,
            file_name=file.filename,
            file_path=file_path,
            file_type=get_file_type(file.filename),
            role_access=role_access,
            uploaded_by=user_id
        )
        db.add(doc)
        db.commit()
        
        job_id = enqueue_document_processing(
            document_id=str(document_id),
            file_path=file_path,
            role_access=role_access
        )
        
        return {
            "document_id": str(document_id),
            "project_id": str(project_id),
            "file_name": file.filename,
            "status": "pending",
            "message": "Document queued for processing",
            "job_id": job_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/repos/upload")
async def upload_repo(
    project_id: UUID,
    repo_data: GitRepoUpload,
    request: Request,
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return JSONResponse({"error": "Project not found"}, status_code=404)
        
    existing_repo = db.query(GitRepo).filter(
        GitRepo.project_id == project_id,
        GitRepo.repo_url == repo_data.repo_url
    ).first()
    
    if existing_repo:
        return JSONResponse({"error": "Repo already uploaded"}, status_code=400)
        
    try:
        repo_id = uuid.uuid4()
        
        repo = GitRepo(
            id=repo_id,
            project_id=project_id,
            repo_url=repo_data.repo_url,
            repo_name=repo_data.repo_name,
            role_access=repo_data.role_access
        )
        db.add(repo)
        db.commit()
        
        job_id = enqueue_repo_processing(
            repo_id=str(repo_id),
            repo_url=repo_data.repo_url,
            role_access=repo_data.role_access
        )
        
        return {
            "repo_id": str(repo_id),
            "project_id": str(project_id),
            "repo_name": repo_data.repo_name,
            "status": "pending",
            "job_id": job_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents/{job_id}/status")
async def document_status(project_id: UUID, job_id: str, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    status = get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return status

@router.get("/assets")
async def get_assets(project_id: UUID, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    docs = db.query(Document).filter(Document.project_id == project_id).all()
    repos = db.query(GitRepo).filter(GitRepo.project_id == project_id).all()
    
    # Filter by RBAC
    allowed_docs = [doc for doc in docs if check_asset_access(user_role, doc.role_access)]
    allowed_repos = [repo for repo in repos if check_asset_access(user_role, repo.role_access)]
    
    return {
        "documents": [
            {
                "id": str(doc.id),
                "file_name": doc.file_name,
                "file_type": doc.file_type,
                "status": doc.processing_status,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "role_access": doc.role_access
            } for doc in allowed_docs
        ],
        "git_repos": [
            {
                "id": str(repo.id),
                "repo_name": repo.repo_name,
                "repo_url": repo.repo_url,
                "status": repo.processing_status,
                "uploaded_at": repo.uploaded_at.isoformat() if repo.uploaded_at else None,
                "indexed_at": repo.indexed_at.isoformat() if repo.indexed_at else None,
                "role_access": repo.role_access
            } for repo in allowed_repos
        ]
    }

@router.get("/assets/{asset_id}")
async def get_asset(project_id: UUID, asset_id: UUID, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)

    doc = db.query(Document).filter(Document.id == asset_id, Document.project_id == project_id).first()
    if doc:
        if not check_asset_access(user_role, doc.role_access):
            return JSONResponse({"error": "Access forbidden"}, status_code=403)
        return {
            "type": "document",
            "id": str(doc.id),
            "file_name": doc.file_name,
            "file_type": doc.file_type,
            "status": doc.processing_status,
            "role_access": doc.role_access,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
        }

    repo = db.query(GitRepo).filter(GitRepo.id == asset_id, GitRepo.project_id == project_id).first()
    if repo:
        if not check_asset_access(user_role, repo.role_access):
            return JSONResponse({"error": "Access forbidden"}, status_code=403)
        return {
            "type": "git_repo",
            "id": str(repo.id),
            "repo_name": repo.repo_name,
            "repo_url": repo.repo_url,
            "status": repo.processing_status,
            "role_access": repo.role_access,
            "uploaded_at": repo.uploaded_at.isoformat() if repo.uploaded_at else None
        }

    return JSONResponse({"error": "Asset not found"}, status_code=404)

# File types that should be rendered inline in the browser (not forced to download)
INLINE_TYPES = {"pdf", "png", "jpg", "jpeg", "webp", "gif", "svg"}

TEXT_EXTENSIONS = {
    "md", "markdown", "txt", "py", "js", "jsx", "ts", "tsx", "json",
    "html", "css", "scss", "yaml", "yml", "sh", "bash", "java", "go",
    "rs", "c", "cpp", "h", "cs", "sql", "xml", "toml", "ini", "env"
}

@router.get("/assets/{asset_id}/content")
async def get_asset_content(
    project_id: UUID,
    asset_id: UUID,
    request: Request,
    file_path: str = None,
    download: bool = False,
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)

    doc = db.query(Document).filter(Document.id == asset_id, Document.project_id == project_id).first()
    if doc:
        if not check_asset_access(user_role, doc.role_access):
            return JSONResponse({"error": "Access forbidden"}, status_code=403)

        # 1. Resolve actual path on disk
        actual_path = doc.file_path
        if not os.path.exists(actual_path):
            # Check if this document is linked to a git repo (e.g. synthetic README doc)
            meta = getattr(doc, "metadata_", None) or {}
            repo_id = meta.get("repo_id")
            if repo_id:
                repo = db.query(GitRepo).filter(GitRepo.id == repo_id).first()
                if repo and repo.local_path:
                    # Check direct join with file_path
                    candidate = os.path.join(repo.local_path, doc.file_path)
                    if os.path.exists(candidate):
                        actual_path = candidate
                    else:
                        for rname in ["README.md", "readme.md", "README.txt", "README", "Readme.md"]:
                            cand = os.path.join(repo.local_path, rname)
                            if os.path.exists(cand):
                                actual_path = cand
                                break

        ext = (doc.file_type or "").lower().lstrip(".")

        if os.path.exists(actual_path):
            if download:
                return FileResponse(
                    actual_path,
                    filename=doc.file_name,
                    headers={"Content-Disposition": f"attachment; filename=\"{doc.file_name}\""}
                )

            # For text/code/markdown types, return plain text response for seamless viewer display
            if ext in TEXT_EXTENSIONS:
                try:
                    with open(actual_path, "r", encoding="utf-8", errors="replace") as f:
                        text_body = f.read()
                    return Response(
                        content=text_body,
                        media_type="text/plain; charset=utf-8",
                        headers={"Content-Disposition": f"inline; filename=\"{doc.file_name}\""}
                    )
                except Exception as e:
                    logger.warning(f"Error reading file {actual_path}: {e}")

            if ext in INLINE_TYPES:
                return FileResponse(
                    actual_path,
                    filename=doc.file_name,
                    headers={"Content-Disposition": f"inline; filename=\"{doc.file_name}\""}
                )
            return FileResponse(
                actual_path,
                filename=doc.file_name,
                headers={"Content-Disposition": f"attachment; filename=\"{doc.file_name}\""}
            )

        # 2. Fallback: If file is missing on disk, return reconstructed text from document_chunks
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.chunk_order)
            .all()
        )
        if chunks:
            combined = "\n\n".join(c.content for c in chunks)
            if download:
                return Response(
                    content=combined,
                    media_type="text/markdown; charset=utf-8",
                    headers={"Content-Disposition": f"attachment; filename=\"{doc.file_name}.md\""}
                )
            return Response(
                content=combined,
                media_type="text/plain; charset=utf-8",
                headers={"Content-Disposition": f"inline; filename=\"{doc.file_name}\""}
            )

        return JSONResponse({"error": "File missing on server"}, status_code=404)

    repo = db.query(GitRepo).filter(GitRepo.id == asset_id, GitRepo.project_id == project_id).first()
    if repo:
        if not check_asset_access(user_role, repo.role_access):
            return JSONResponse({"error": "Access forbidden"}, status_code=403)
            
        if not file_path:
            return JSONResponse({"error": "File path required for git repo"}, status_code=400)
            
        if not repo.local_path or not os.path.exists(repo.local_path):
            return JSONResponse({"error": "Repository not available locally"}, status_code=404)
            
        # Prevent directory traversal attacks
        safe_path = os.path.abspath(os.path.join(repo.local_path, file_path))
        if not safe_path.startswith(os.path.abspath(repo.local_path)):
            return JSONResponse({"error": "Invalid path"}, status_code=400)
            
        if not os.path.exists(safe_path) or not os.path.isfile(safe_path):
            return JSONResponse({"error": "File not found"}, status_code=404)
            
        return FileResponse(
            safe_path,
            filename=os.path.basename(safe_path),
            headers={"Content-Disposition": f"attachment; filename=\"{os.path.basename(safe_path)}\""}
        )

    return JSONResponse({"error": "Asset not found"}, status_code=404)

@router.get("/assets/{asset_id}/tree")
async def get_asset_tree(project_id: UUID, asset_id: UUID, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)

    repo = db.query(GitRepo).filter(GitRepo.id == asset_id, GitRepo.project_id == project_id).first()
    if not repo:
        return JSONResponse({"error": "Repository not found"}, status_code=404)
        
    if not check_asset_access(user_role, repo.role_access):
        return JSONResponse({"error": "Access forbidden"}, status_code=403)
        
    if not repo.local_path or not os.path.exists(repo.local_path):
        return JSONResponse({"error": "Repository not available locally"}, status_code=404)
        
    def build_tree(dir_path):
        tree = []
        try:
            for entry in os.scandir(dir_path):
                if entry.name == '.git':
                    continue
                node = {
                    "name": entry.name,
                    "path": os.path.relpath(entry.path, repo.local_path).replace("\\", "/"),
                    "is_dir": entry.is_dir()
                }
                if entry.is_dir():
                    node["children"] = build_tree(entry.path)
                tree.append(node)
        except Exception:
            pass
        return sorted(tree, key=lambda x: (not x["is_dir"], x["name"]))
        
    return {"tree": build_tree(repo.local_path)}

@router.delete("/documents/{document_id}")
async def delete_document_asset(project_id: UUID, document_id: UUID, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role

    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)

    if not has_permission(user_role, "team_lead"):
        return JSONResponse({"error": "Only managers and team leads can delete assets"}, status_code=403)

    doc = db.query(Document).filter(Document.id == document_id, Document.project_id == project_id).first()
    if not doc:
        return JSONResponse({"error": "Asset not found in this project"}, status_code=404)
        
    if not check_asset_access(user_role, doc.role_access):
        return JSONResponse({"error": "Access forbidden"}, status_code=403)

    file_path = doc.file_path
    try:
        deleted_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete(synchronize_session=False)
        db.delete(doc)
        db.commit()

        if file_path and os.path.exists(file_path):
            os.remove(file_path)

        return {
            "message": "Asset deleted",
            "document_id": str(document_id),
            "deleted_chunks": deleted_chunks,
            "indexed_data_removed": True
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete asset and indexed data") from e

@router.delete("/repos/{repo_id}")
async def delete_repo_asset(project_id: UUID, repo_id: UUID, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role

    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)

    if not has_permission(user_role, "team_lead"):
        return JSONResponse({"error": "Only managers and team leads can delete assets"}, status_code=403)

    repo = db.query(GitRepo).filter(GitRepo.id == repo_id, GitRepo.project_id == project_id).first()
    if not repo:
        return JSONResponse({"error": "Repository asset not found in this project"}, status_code=404)

    if not check_asset_access(user_role, repo.role_access):
        return JSONResponse({"error": "Access forbidden"}, status_code=403)

    try:
        deleted_assets = db.query(ReusableAsset).filter(ReusableAsset.repo_id == repo.id).delete(synchronize_session=False)
        db.delete(repo)
        db.commit()

        return {
            "message": "Repository asset deleted",
            "repo_id": str(repo_id),
            "deleted_assets": deleted_assets,
            "indexed_data_removed": True
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete repository asset and indexed data") from e

@router.get("/documents/chunks/{chunk_id}")
async def get_document_chunk(
    project_id: UUID,
    chunk_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """Retrieve specific document chunk content and context for citation viewing"""
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role

    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)

    chunk = (
        db.query(DocumentChunk)
        .join(Document, DocumentChunk.document_id == Document.id)
        .filter(
            DocumentChunk.id == chunk_id,
            Document.project_id == project_id
        )
        .first()
    )
    if not chunk:
        return JSONResponse({"error": "Document chunk not found"}, status_code=404)

    doc = chunk.document
    if doc and not check_asset_access(user_role, doc.role_access):
        return JSONResponse({"error": "Access forbidden"}, status_code=403)

    return {
        "chunk_id": str(chunk.id),
        "document_id": str(chunk.document_id),
        "chunk_order": chunk.chunk_order,
        "content": chunk.content,
        "chunk_path": chunk.chunk_path,
        "file_name": chunk.file_name or (doc.file_name if doc else None),
        "metadata": chunk.metadata_ or {}
    }
