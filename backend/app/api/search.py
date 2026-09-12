from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime, timedelta
import math
from uuid import UUID

from app.database import get_db
from app.models.document import DocumentChunk, Document
from app.models.asset import ReusableAsset, GitRepo
from app.schemas import SearchRequest, SearchResponse
from app.services.search.hybrid_search import hybrid_search
from app.api.projects import check_project_membership

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Search & Discovery"])

@router.post("/search", response_model=dict)
async def perform_search(
    project_id: UUID,
    request: Request,
    search_req: SearchRequest,
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role
    
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    filters = search_req.filters.model_dump() if search_req.filters else {}
    
    results, total = hybrid_search(
        db=db,
        project_id=project_id,
        query=search_req.query,
        user_role=user_role,
        filters=filters,
        page=search_req.page,
        page_size=search_req.page_size
    )
    
    total_pages = math.ceil(total / search_req.page_size) if total > 0 else 1
    
    return {
        "results": results,
        "total": total,
        "page": search_req.page,
        "total_pages": total_pages
    }
