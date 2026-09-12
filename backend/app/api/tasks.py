from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.database import get_db
from app.models.task import Task
from app.models.project import Project, ProjectMember
from app.models.developer import Developer
from app.schemas import TaskCreate, TaskUpdate, TaskResponse
from app.api.projects import check_project_membership

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Tasks"])

VALID_STATUSES = {"backlog", "todo", "in_progress", "review", "done", "completed"}
VALID_PRIORITIES = {"low", "medium", "high"}

def serialize_task(task: Task) -> dict:
    return {
        "id": str(task.id),
        "project_id": str(task.project_id),
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assigned_to": str(task.assigned_to) if task.assigned_to else None,
        "assignee": {
            "id": str(task.assignee.id),
            "name": task.assignee.name,
            "role": task.assignee.role,
        } if task.assignee else None,
        "created_by": str(task.created_by),
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "time_estimate": task.time_estimate,
    }

def get_project_members_list(db: Session, project_id: UUID) -> list:
    members = db.query(ProjectMember, Developer).join(
        Developer, ProjectMember.developer_id == Developer.id
    ).filter(
        ProjectMember.project_id == project_id
    ).all()
    return [
        {"id": str(member.developer_id), "name": dev.name, "role": dev.role}
        for member, dev in members
    ]

@router.post("/tasks", response_model=dict)
async def create_task(
    project_id: UUID,
    task_data: TaskCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return JSONResponse({"error": "Project not found"}, status_code=404)
        
    if task_data.assigned_to:
        assignee_uuid = task_data.assigned_to
        if not check_project_membership(db, assignee_uuid, project_id):
            return JSONResponse(
                {
                    "error": "Cannot assign to non-project member. Only project members can be assigned tasks.",
                    "valid_assignees": get_project_members_list(db, project_id)
                },
                status_code=400
            )

    if task_data.status and task_data.status not in VALID_STATUSES:
        return JSONResponse({"error": "Invalid task status"}, status_code=400)

    if task_data.priority and task_data.priority not in VALID_PRIORITIES:
        return JSONResponse({"error": "Invalid task priority"}, status_code=400)
            
    task = Task(
        project_id=project_id,
        title=task_data.title,
        description=task_data.description,
        priority=task_data.priority,
        assigned_to=task_data.assigned_to,
        created_by=user_id,
        status=task_data.status or "backlog",
        due_date=task_data.due_date,
        time_estimate=task_data.time_estimate,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    return serialize_task(task)

@router.patch("/tasks/{task_id}", response_model=dict)
async def update_task(
    project_id: UUID,
    task_id: UUID,
    task_data: TaskUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "Not a project member"}, status_code=403)
        
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        return JSONResponse({"error": "Task not found"}, status_code=404)
        
    if task_data.assigned_to and task_data.assigned_to != task.assigned_to:
        if not check_project_membership(db, task_data.assigned_to, project_id):
            return JSONResponse(
                {
                    "error": "Cannot assign to non-project member. Only project members can be assigned tasks.",
                    "valid_assignees": get_project_members_list(db, project_id)
                },
                status_code=400
            )

    update_data = task_data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        return JSONResponse({"error": "Invalid task status"}, status_code=400)

    if "priority" in update_data and update_data["priority"] not in VALID_PRIORITIES:
        return JSONResponse({"error": "Invalid task priority"}, status_code=400)
            
    for field, value in update_data.items():
        setattr(task, field, value)
        
    db.commit()
    db.refresh(task)
    
    return serialize_task(task)

@router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(
    project_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    user_id = UUID(request.state.user_id)
    
    if not check_project_membership(db, user_id, project_id):
        raise HTTPException(status_code=403, detail="Not a project member")
        
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    return tasks
