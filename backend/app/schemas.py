from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID

# ----- Developer Schemas -----
class DeveloperBase(BaseModel):
    name: str
    email: str
    role: str
    skills: Optional[List[str]] = None
    projects: Optional[List[str]] = None

class DeveloperCreate(DeveloperBase):
    pass

class DeveloperResponse(DeveloperBase):
    id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ----- Project Schemas -----
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass # created_by comes from headers

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ----- Task Schemas -----
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    assigned_to: Optional[UUID] = None
    due_date: Optional[date] = None
    time_estimate: Optional[int] = None

class TaskCreate(TaskBase):
    status: Optional[str] = "backlog"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[UUID] = None
    due_date: Optional[date] = None
    time_estimate: Optional[int] = None

class TaskAssigneeResponse(BaseModel):
    id: UUID
    name: str
    role: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TaskResponse(TaskBase):
    id: UUID
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    assignee: Optional[TaskAssigneeResponse] = None
    model_config = ConfigDict(from_attributes=True)

class TaskHistoryResponse(BaseModel):
    changed_by: UUID
    field_changed: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TaskContributorCreate(BaseModel):
    developer_id: UUID
    role: str

class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int

# ----- Search Schemas -----
class SearchFilters(BaseModel):
    project_id: Optional[str] = None
    document_type: Optional[str] = None
    language: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    filters: Optional[SearchFilters] = None
    page: int = 1
    page_size: int = 20

class SearchResult(BaseModel):
    type: str
    id: str
    chunk_id: Optional[str] = None
    title: str
    snippet: str
    relevance_score: float
    source: str
    metadata: Dict[str, Any]

class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    page: int
    total_pages: int

# ----- Chat Schemas -----
class ChatMessageRequest(BaseModel):
    session_id: Optional[UUID] = None
    message: str

class ChatSource(BaseModel):
    id: str
    type: str
    title: str

class ChatMessageResponse(BaseModel):
    session_id: UUID
    intent: str
    response: str
    confidence: float
    sources: List[ChatSource]
    follow_up_suggestions: List[str]

class ChatSessionStartResponse(BaseModel):
    session_id: UUID
    created_at: datetime

