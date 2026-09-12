import logging
import json
import re
from datetime import datetime, date
from uuid import UUID
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.task import Task
from app.models.chat import SuggestedTask
from app.models.developer import Developer
from app.models.project import ProjectMember
from app.utils.ollama_client import ollama_client

logger = logging.getLogger(__name__)

TASK_CREATION_TEMPLATE = {
    "title": "Short title describing the task (e.g., 'Implement JWT Authentication')",
    "description": "Clear description of what needs to be done, context, and requirements",
    "priority": "low | medium | high",
    "status": "backlog | todo | in_progress",
    "assignee_name": "Name of assigned member or null",
    "assigned_to": "UUID string of assigned member or null",
    "due_date": "YYYY-MM-DD or null",
    "time_estimate": "Estimated hours as integer or null"
}


def get_project_members(db: Session, project_id: UUID) -> List[Dict[str, Any]]:
    """Retrieve all developers belonging to the project."""
    members = (
        db.query(ProjectMember, Developer)
        .join(Developer, ProjectMember.developer_id == Developer.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )
    return [
        {"id": str(dev.id), "name": dev.name, "role": dev.role, "email": dev.email}
        for _, dev in members
    ]


def _match_assignee(assignee_name: Optional[str], members: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Match a name string to an existing project member."""
    if not assignee_name or not assignee_name.strip():
        return None
    name_clean = assignee_name.strip().lower()
    for m in members:
        m_name = m["name"].lower()
        if name_clean in m_name or m_name in name_clean:
            return m
        if name_clean == m_name.split()[0]:
            return m
    return None


def extract_task_draft(
    db: Session,
    project_id: UUID,
    user_message: str,
    history: List[Dict[str, str]]
) -> Dict[str, Any]:
    """
    Extract a structured task draft from user message using Ollama JSON mode.
    """
    members = get_project_members(db, project_id)
    members_desc = ", ".join([f"{m['name']} ({m['role']})" for m in members]) or "No members listed"

    recent_history = "\n".join([f"{h['role']}: {h['content']}" for h in history[-4:]]) if history else "None"

    prompt = f"""You are an expert technical project manager.
The user wants to create a project task.
Extract the task details from the user's message and conversation into the following JSON format:

Task Template Schema:
{{
  "title": "A concise, actionable task title (max 80 chars)",
  "description": "Detailed explanation of what needs to be implemented or fixed (2-3 sentences)",
  "priority": "low" | "medium" | "high",
  "status": "todo" | "backlog",
  "assignee_name": "Member name if specified, otherwise null",
  "due_date": "YYYY-MM-DD if mentioned, otherwise null",
  "time_estimate": integer hours if mentioned, otherwise null
}}

Available Project Members:
{members_desc}

Recent Conversation:
{recent_history}

User Message:
"{user_message}"

Respond ONLY with the JSON object conforming to the schema above. No other text."""

    try:
        res = ollama_client.generate(model="mistral:7b", prompt=prompt, format="json")
        raw = res.get("response", "{}")
        draft = json.loads(raw)
    except Exception as e:
        logger.error(f"Failed to extract task draft with Ollama: {e}", exc_info=True)
        draft = {
            "title": user_message[:60],
            "description": user_message,
            "priority": "medium",
            "status": "todo",
            "assignee_name": None,
            "due_date": None,
            "time_estimate": None
        }

    # Validate and normalize
    title = str(draft.get("title") or user_message[:60]).strip()
    description = str(draft.get("description") or title).strip()
    priority = str(draft.get("priority") or "medium").lower().strip()
    if priority not in {"low", "medium", "high"}:
        priority = "medium"
    status = str(draft.get("status") or "todo").lower().strip()
    if status not in {"backlog", "todo", "in_progress"}:
        status = "todo"

    assignee_name = draft.get("assignee_name")
    assigned_to_id = None
    if assignee_name:
        matched = _match_assignee(str(assignee_name), members)
        if matched:
            assigned_to_id = matched["id"]
            assignee_name = matched["name"]
        else:
            assignee_name = None

    due_date = draft.get("due_date")
    if due_date and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(due_date)):
        due_date = None

    time_estimate = draft.get("time_estimate")
    if time_estimate is not None:
        try:
            time_estimate = int(time_estimate)
        except (ValueError, TypeError):
            time_estimate = None

    return {
        "title": title,
        "description": description,
        "priority": priority,
        "status": status,
        "assignee_name": assignee_name,
        "assigned_to": assigned_to_id,
        "due_date": due_date,
        "time_estimate": time_estimate
    }


def update_task_draft(
    db: Session,
    project_id: UUID,
    current_draft: Dict[str, Any],
    user_message: str
) -> Dict[str, Any]:
    """
    Update an existing task draft with user's feedback/improvements.
    """
    members = get_project_members(db, project_id)
    members_desc = ", ".join([f"{m['name']} ({m['role']})" for m in members]) or "No members listed"

    prompt = f"""You are a technical project manager assistant.
The user wants to modify an existing drafted task.
Update the current task JSON with the user's requested changes.

Current Task Draft:
{json.dumps(current_draft, indent=2)}

Available Project Members:
{members_desc}

User Feedback / Modifications:
"{user_message}"

Instructions:
- Keep all fields that the user did not ask to change.
- Modify ONLY the fields the user wants changed (e.g. priority, title, description, assignee, due_date, time_estimate).
- Ensure priority is one of: "low", "medium", "high".
- Ensure status is one of: "todo", "backlog", "in_progress".
- Respond ONLY with the updated JSON object. No extra text."""

    try:
        res = ollama_client.generate(model="mistral:7b", prompt=prompt, format="json")
        raw = res.get("response", "{}")
        updated = json.loads(raw)
    except Exception as e:
        logger.error(f"Failed to update task draft: {e}", exc_info=True)
        updated = dict(current_draft)

    # Merge and preserve existing values if missing
    for k in ["title", "description", "priority", "status", "assignee_name", "due_date", "time_estimate"]:
        if k not in updated or updated[k] is None:
            updated[k] = current_draft.get(k)

    # Validate priority & status
    if str(updated.get("priority", "")).lower() in {"low", "medium", "high"}:
        updated["priority"] = str(updated["priority"]).lower()
    else:
        updated["priority"] = current_draft.get("priority", "medium")

    if str(updated.get("status", "")).lower() in {"backlog", "todo", "in_progress"}:
        updated["status"] = str(updated["status"]).lower()
    else:
        updated["status"] = current_draft.get("status", "todo")

    # Match assignee
    assignee_name = updated.get("assignee_name")
    if assignee_name:
        matched = _match_assignee(str(assignee_name), members)
        if matched:
            updated["assigned_to"] = matched["id"]
            updated["assignee_name"] = matched["name"]
        else:
            updated["assigned_to"] = current_draft.get("assigned_to")
    else:
        updated["assigned_to"] = None

    return updated


def format_task_preview(draft: Dict[str, Any], is_update: bool = False) -> str:
    """Format the task preview and request user permission."""
    prefix = "I've updated the task details based on your feedback:" if is_update else "I've drafted a task based on your request:"
    
    priority_badges = {
        "high": "🔴 HIGH",
        "medium": "🟡 MEDIUM",
        "low": "🟢 LOW"
    }
    p_str = priority_badges.get(draft.get("priority", "medium").lower(), "🟡 MEDIUM")

    assignee = draft.get("assignee_name") or "Unassigned"
    due = draft.get("due_date") or "None"
    est = f"{draft.get('time_estimate')}h" if draft.get("time_estimate") else "None"

    return (
        f"{prefix}\n\n"
        f"📋 **Task Preview**:\n"
        f"• **Title:** {draft.get('title')}\n"
        f"• **Description:** {draft.get('description')}\n"
        f"• **Priority:** {p_str}\n"
        f"• **Status:** `{draft.get('status', 'todo')}`\n"
        f"• **Assignee:** {assignee}\n"
        f"• **Due Date:** {due}\n"
        f"• **Estimate:** {est}\n\n"
        f"👉 **Is this task with these details OK to create?**\n"
        f"*(Reply **Yes** to create it, or let me know what changes to make!)*"
    )


def execute_create_task(
    db: Session,
    project_id: UUID,
    user_id: UUID,
    session_id: UUID,
    draft: Dict[str, Any]
) -> Task:
    """
    Execute tool call: Insert task into PostgreSQL and mark SuggestedTask confirmed.
    """
    parsed_due_date = None
    if draft.get("due_date"):
        try:
            parsed_due_date = datetime.strptime(str(draft["due_date"]).strip(), "%Y-%m-%d").date()
        except ValueError:
            parsed_due_date = None

    assigned_uuid = None
    if draft.get("assigned_to"):
        try:
            assigned_uuid = UUID(str(draft["assigned_to"]))
        except (ValueError, TypeError):
            assigned_uuid = None

    time_est = None
    if draft.get("time_estimate") is not None:
        try:
            time_est = int(draft["time_estimate"])
        except (ValueError, TypeError):
            time_est = None

    task = Task(
        project_id=project_id,
        title=draft.get("title", "Untitled Task"),
        description=draft.get("description"),
        status=draft.get("status", "todo"),
        priority=draft.get("priority", "medium"),
        assigned_to=assigned_uuid,
        created_by=user_id,
        due_date=parsed_due_date,
        time_estimate=time_est
    )
    db.add(task)

    pending_suggestions = (
        db.query(SuggestedTask)
        .filter(
            SuggestedTask.session_id == session_id,
            SuggestedTask.status == "pending"
        )
        .all()
    )
    for s in pending_suggestions:
        s.status = "confirmed"

    db.commit()
    db.refresh(task)
    logger.info(f"Task created via AI Chat: id={task.id}, title='{task.title}'")
    return task


def get_pending_task(db: Session, session_id: UUID) -> Optional[SuggestedTask]:
    """Get the latest pending suggested task for this chat session."""
    return (
        db.query(SuggestedTask)
        .filter(
            SuggestedTask.session_id == session_id,
            SuggestedTask.status == "pending"
        )
        .order_by(SuggestedTask.created_at.desc())
        .first()
    )
