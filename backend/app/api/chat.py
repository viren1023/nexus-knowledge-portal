from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from uuid import UUID
from datetime import datetime
import uuid

from app.database import get_db
from app.models.chat import ChatSession, ChatHistory, SuggestedTask
from app.models.document import Document, DocumentChunk
from app.models.asset import GitRepo, ReusableAsset
from app.models.task import Task
from app.schemas import ChatMessageRequest, ChatMessageResponse, ChatSessionStartResponse
from app.services.chat.intent_classifier import classify_intent
from app.services.chat.context_retriever import retrieve_context
from app.services.chat.response_generator import generate_response_for_chat
from app.services.chat.task_tool import (
    extract_task_draft,
    update_task_draft,
    format_task_preview,
    execute_create_task,
    get_pending_task
)
from app.api.projects import check_project_membership

router = APIRouter(prefix="/api/projects/{project_id}/chat", tags=["AI Chatbot"])

def check_project_has_content(db: Session, project_id: UUID) -> dict:
    """Check if project has indexed content"""
    doc_count = db.query(DocumentChunk).filter(
        DocumentChunk.document_id.in_(
            db.query(Document.id).filter(Document.project_id == project_id)
        )
    ).count()
    
    repo_count = db.query(ReusableAsset).filter(
        ReusableAsset.repo_id.in_(
            db.query(GitRepo.id).filter(GitRepo.project_id == project_id)
        )
    ).count()
    
    task_count = db.query(Task).filter(Task.project_id == project_id).count()
    
    has_content = doc_count > 0 or repo_count > 0 or task_count > 0
    
    return {
        "has_content": has_content,
        "document_count": doc_count,
        "asset_count": repo_count,
        "task_count": task_count
    }

@router.get("/check-content")
async def check_content(project_id: UUID, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    return check_project_has_content(db, project_id)

@router.post("/session/start", response_model=dict)
async def start_chat_session(
    project_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role
    
    # Verify membership
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    session_id = uuid.uuid4()
    
    chat_session = ChatSession(
        id=session_id,
        developer_id=user_id,
        project_id=project_id,
        user_role=user_role
    )
    db.add(chat_session)
    db.commit()
    
    return {
        "session_id": str(session_id),
        "project_id": str(project_id)
    }

@router.post("/message", response_model=dict)
async def send_chat_message(
    project_id: UUID,
    chat_data: ChatMessageRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    user_role = request.state.user_role
    
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    content_status = check_project_has_content(db, project_id)
    
    if not content_status["has_content"]:
        return {
            "session_id": str(chat_data.session_id),
            "intent": "no_content",
            "response": "This project has no indexed content yet. Please:\n\n1. Upload documents (PDFs, Word, Markdown)\n2. Link Git repositories\n3. Create tasks\n\nOnce content is added, I can help you discover and manage it!",
            "confidence": 1.0,
            "sources": [],
            "chat_enabled": False,
            "follow_up_suggestions": ["Upload a document", "Link a Git repository", "Create a task"]
        }
        
    session = db.query(ChatSession).filter(ChatSession.id == chat_data.session_id, ChatSession.project_id == project_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found in this project")
        
    history_records = db.query(ChatHistory).filter(
        ChatHistory.session_id == chat_data.session_id
    ).order_by(ChatHistory.created_at.asc()).all()
    
    history = []
    for r in history_records:
        history.append({"role": r.message_type, "content": r.content})
        
    user_message = chat_data.message
    
    db.add(ChatHistory(session_id=chat_data.session_id, message_type="user", content=user_message))
    db.commit()
    
    # Check if there is an active pending task for this chat session
    pending_task = get_pending_task(db, chat_data.session_id)
    intent = classify_intent(user_message, has_pending_task=bool(pending_task))
    
    suggested_task_payload = None
    sources = []
    confidence = 0.85
    follow_ups = []

    if intent == "task_create":
        # 1. Draft task from template using Ollama
        draft = extract_task_draft(db, project_id, user_message, history)
        
        # 2. Store in suggested_tasks as pending (supersede any prior pending task)
        if pending_task:
            pending_task.status = "superseded"
            db.commit()

        new_suggestion = SuggestedTask(
            id=uuid.uuid4(),
            session_id=chat_data.session_id,
            suggested_task=draft,
            status="pending"
        )
        db.add(new_suggestion)
        db.commit()

        response_text = format_task_preview(draft, is_update=False)
        suggested_task_payload = {
            "id": str(new_suggestion.id),
            "status": "pending",
            "task": draft
        }
        follow_ups = ["Yes, create it", "Change priority to high", "Cancel"]

    elif intent == "task_confirm":
        if pending_task:
            draft = pending_task.suggested_task
            created_task = execute_create_task(db, project_id, user_id, chat_data.session_id, draft)
            assignee_name = created_task.assignee.name if created_task.assignee else "Unassigned"
            due_str = str(created_task.due_date) if created_task.due_date else "None"
            
            response_text = (
                f"✅ **Task Created Successfully!**\n\n"
                f"• **Title:** {created_task.title}\n"
                f"• **Status:** `{created_task.status}`\n"
                f"• **Priority:** `{created_task.priority.upper()}`\n"
                f"• **Assignee:** {assignee_name}\n"
                f"• **Due Date:** {due_str}\n\n"
                f"The task is now live on your project board."
            )
            suggested_task_payload = {
                "id": str(pending_task.id),
                "status": "confirmed",
                "task_id": str(created_task.id),
                "task": draft
            }
            follow_ups = ["View all tasks", "Create another task", "What is this project about?"]
        else:
            response_text = "There is no pending task to confirm. What task would you like to create?"
            follow_ups = ["Create a task for bug fix", "Create a task for documentation"]

    elif intent == "task_update":
        if pending_task:
            current_draft = pending_task.suggested_task
            updated_draft = update_task_draft(db, project_id, current_draft, user_message)
            pending_task.suggested_task = updated_draft
            db.commit()

            response_text = format_task_preview(updated_draft, is_update=True)
            suggested_task_payload = {
                "id": str(pending_task.id),
                "status": "pending",
                "task": updated_draft
            }
            follow_ups = ["Yes, create it", "Change priority to high", "Cancel"]
        else:
            draft = extract_task_draft(db, project_id, user_message, history)
            new_suggestion = SuggestedTask(
                id=uuid.uuid4(),
                session_id=chat_data.session_id,
                suggested_task=draft,
                status="pending"
            )
            db.add(new_suggestion)
            db.commit()
            response_text = format_task_preview(draft, is_update=False)
            suggested_task_payload = {
                "id": str(new_suggestion.id),
                "status": "pending",
                "task": draft
            }
            follow_ups = ["Yes, create it", "Cancel"]

    elif intent == "task_cancel":
        if pending_task:
            pending_task.status = "rejected"
            db.commit()
            response_text = "❌ **Task draft cancelled.** Let me know if you want to create a different task or need anything else!"
            suggested_task_payload = {
                "id": str(pending_task.id),
                "status": "rejected"
            }
            follow_ups = ["Create a task", "Show project overview", "Search codebase"]
        else:
            response_text = "There is no pending task to cancel. How else can I help you?"
            follow_ups = ["What can you do?", "What is this project about?"]

    else:
        # Standard retrieval & response generation for knowledge_qa, asset_search, project_overview, task_query, etc.
        context = retrieve_context(db, str(project_id), intent, user_message, user_role)
        response_text, confidence, sources = generate_response_for_chat(intent, context, user_message, history)
        
        if intent == "knowledge_qa":
            follow_ups = ["Tell me more about this", "Where can I find the code?"]
        elif intent == "asset_search":
            follow_ups = ["Show me an example", "What are its dependencies?"]
        elif intent == "project_overview":
            follow_ups = ["What are the main entry points?", "Show me reusable assets", "Tell me about the project structure"]
        elif intent == "task_query":
            follow_ups = ["Create a new task", "Show open tasks"]
    
    db.add(ChatHistory(
        session_id=chat_data.session_id, 
        message_type="assistant", 
        content=response_text,
        metadata_={
            "intent": intent,
            "sources": sources,
            "confidence": confidence,
            "suggested_task": suggested_task_payload
        }
    ))
    db.commit()
        
    return {
        "session_id": str(chat_data.session_id),
        "intent": intent,
        "response": response_text,
        "confidence": confidence,
        "sources": sources,
        "suggested_task": suggested_task_payload,
        "chat_enabled": True,
        "follow_up_suggestions": follow_ups
    }

@router.get("/session/{session_id}/history")
async def get_chat_history(
    project_id: UUID,
    session_id: UUID, 
    request: Request,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    history = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id
    ).order_by(desc(ChatHistory.created_at)).limit(limit).all()
    
    history.reverse()
    
    return [
        {
            "id": str(h.id),
            "role": h.message_type,
            "content": h.content,
            "created_at": h.created_at.isoformat(),
            "metadata": h.metadata_ or {}
        } for h in history
    ]
