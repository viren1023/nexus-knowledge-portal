from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.database import get_db
from app.models.project import Project, ProjectMember
from app.models.developer import Developer
from app.models.task import Task
from app.schemas import ProjectCreate, ProjectResponse
from app.utils.roles import has_permission

router = APIRouter(prefix="/api/projects", tags=["Projects"])

def check_project_membership(db: Session, user_id: UUID, project_id: UUID) -> bool:
    """Verify user is member of project"""
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.developer_id == user_id
    ).first()
    return member is not None

def serialize_personal_task(task: Task, project: Project) -> dict:
    return {
        "id": str(task.id),
        "project_id": str(project.id),
        "project_name": project.name,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }

@router.post("", response_model=dict)
async def create_project(
    project_data: ProjectCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    user_role = request.state.user_role
    user_id = request.state.user_id
    
    # Guardrail: Only managers can create projects
    if user_role != "manager":
        return JSONResponse(
            {"error": f"Only managers can create projects. Your role: {user_role}"},
            status_code=403
        )
    
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    # Create project
    new_project = Project(
        name=project_data.name,
        description=project_data.description,
        created_by=user_uuid
    )
    db.add(new_project)
    db.commit()
    
    # Auto-add creator as project member
    project_member = ProjectMember(
        project_id=new_project.id,
        developer_id=user_uuid,
        is_creator=True
    )
    db.add(project_member)
    db.commit()
    
    return {"project_id": str(new_project.id), "message": "Project created"}

@router.get("", response_model=dict)
async def get_projects(request: Request, db: Session = Depends(get_db)):
    user_id = request.state.user_id
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    # Get projects where user is a member
    memberships = db.query(ProjectMember).filter(ProjectMember.developer_id == user_uuid).all()
    project_ids = [m.project_id for m in memberships]
    
    projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    
    # For UI we need some stats
    result_projects = []
    for proj in projects:
        members_count = db.query(ProjectMember).filter(ProjectMember.project_id == proj.id).count()
        tasks_count = len(proj.tasks)
        docs_count = len(proj.documents)
        
        result_projects.append({
            "id": str(proj.id),
            "name": proj.name,
            "description": proj.description,
            "team_size": members_count,
            "tasks_count": tasks_count,
            "documents_count": docs_count
        })
        
    return {"projects": result_projects, "total": len(result_projects)}

@router.get("/personal-dashboard", response_model=dict)
async def get_personal_dashboard(request: Request, db: Session = Depends(get_db)):
    user_id = request.state.user_id
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    memberships = db.query(ProjectMember).filter(ProjectMember.developer_id == user_uuid).all()
    project_ids = [m.project_id for m in memberships]

    if not project_ids:
        return {"my_tasks": [], "upcoming_tasks": [], "due_soon_days": 7}

    task_rows = (
        db.query(Task, Project)
        .join(Project, Task.project_id == Project.id)
        .filter(Task.project_id.in_(project_ids), Task.assigned_to == user_uuid)
        .all()
    )

    my_tasks = [serialize_personal_task(task, project) for task, project in task_rows]
    active_tasks = [
        item for item in my_tasks
        if (item.get("status") or "").lower() not in {"done", "completed"}
    ]

    from datetime import date, timedelta
    today = date.today()
    due_soon_limit = today + timedelta(days=7)

    upcoming_tasks = []
    for item in active_tasks:
        if not item["due_date"]:
            continue
        due_date = date.fromisoformat(item["due_date"])
        if due_date < today:
            upcoming_tasks.append({**item, "due_state": "overdue", "days_delta": (due_date - today).days})
        elif due_date <= due_soon_limit:
            upcoming_tasks.append({**item, "due_state": "due_soon", "days_delta": (due_date - today).days})

    upcoming_tasks.sort(key=lambda item: item["due_date"])
    active_tasks.sort(key=lambda item: (item["due_date"] is None, item["due_date"] or "", item["project_name"], item["title"]))

    return {
        "my_tasks": active_tasks,
        "upcoming_tasks": upcoming_tasks,
        "due_soon_days": 7,
    }

@router.get("/{project_id}", response_model=dict)
async def get_project(project_id: UUID, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "You are not a member of this project"}, status_code=403)
        
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    members_count = db.query(ProjectMember).filter(ProjectMember.project_id == proj.id).count()
    return {
        "id": str(proj.id),
        "name": proj.name,
        "description": proj.description,
        "team_size": members_count,
        "created_at": proj.created_at.isoformat()
    }

@router.get("/{project_id}/members", response_model=dict)
async def get_project_members(project_id: UUID, request: Request, db: Session = Depends(get_db)):
    user_id = UUID(request.state.user_id)
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "You are not a member of this project"}, status_code=403)
        
    members = db.query(ProjectMember, Developer).join(
        Developer, ProjectMember.developer_id == Developer.id
    ).filter(
        ProjectMember.project_id == project_id
    ).all()
    
    return {
        "project_id": str(project_id),
        "members": [
            {
                "id": str(member.developer_id),
                "name": dev.name,
                "email": dev.email,
                "role": dev.role,
                "is_creator": member.is_creator,
                "joined_at": member.joined_at.isoformat()
            }
            for member, dev in members
        ]
    }

from app.schemas import ProjectUpdate

@router.patch("/{project_id}", response_model=dict)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    user_role = request.state.user_role
    
    if not has_permission(user_role, "team_lead"):
        return JSONResponse({"error": "Only managers and team leads can update projects"}, status_code=403)
        
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return JSONResponse({"error": "Project not found"}, status_code=404)
        
    for field, value in project_data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
        
    db.commit()
    return {"message": "Project updated"}

from pydantic import BaseModel
class AddMemberRequest(BaseModel):
    developer_id: str

@router.post("/{project_id}/members")
async def add_member_to_project(
    project_id: UUID,
    member_data: AddMemberRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    user_role = request.state.user_role
    user_id = UUID(request.state.user_id)
    
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "You are not a member of this project"}, status_code=403)
        
    if not has_permission(user_role, "team_lead"):
        return JSONResponse({"error": "Only managers and team leads can add members"}, status_code=403)
        
    dev_uuid = UUID(member_data.developer_id)
    
    # Check if already a member
    if check_project_membership(db, dev_uuid, project_id):
        return JSONResponse({"error": "Developer is already a member"}, status_code=400)
        
    new_member = ProjectMember(
        project_id=project_id,
        developer_id=dev_uuid,
        is_creator=False
    )
    db.add(new_member)
    db.commit()
    
    return {"message": f"Member added to project {project_id}"}

@router.delete("/{project_id}/members/{developer_id}")
async def remove_member_from_project(
    project_id: UUID,
    developer_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    user_role = request.state.user_role
    user_id = UUID(request.state.user_id)
    
    if user_role != "manager":
        return JSONResponse({"error": "Only managers can remove team members"}, status_code=403)
        
    if not check_project_membership(db, user_id, project_id):
        return JSONResponse({"error": "You are not a member of this project"}, status_code=403)
        
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.developer_id == developer_id
    ).first()
    
    if not member:
        return JSONResponse({"error": "Member not found in project"}, status_code=404)
        
    if member.is_creator:
        return JSONResponse({"error": "Cannot remove project creator"}, status_code=400)
        
    db.delete(member)
    db.commit()
    
    return {"message": "Member removed from project"}
