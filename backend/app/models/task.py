import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, DateTime, Date, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from .base import Base

class Task(Base):
    __tablename__ = 'tasks'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default='backlog') # 'backlog','todo','in_progress','review','done'
    priority = Column(String, default='medium') # 'high','medium','low'
    assigned_to = Column(UUID(as_uuid=True), ForeignKey('developers.id'), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey('developers.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    due_date = Column(Date, nullable=True)
    time_estimate = Column(Integer, nullable=True) # hours
    metadata_ = Column("metadata", JSONB, nullable=True)

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("Developer", foreign_keys=[assigned_to])
    creator = relationship("Developer", foreign_keys=[created_by])
    contributors = relationship("TaskContributor", back_populates="task", cascade="all, delete-orphan")
    history = relationship("TaskHistory", back_populates="task", cascade="all, delete-orphan")

class TaskContributor(Base):
    __tablename__ = 'task_contributors'

    task_id = Column(UUID(as_uuid=True), ForeignKey('tasks.id', ondelete="CASCADE"), primary_key=True)
    developer_id = Column(UUID(as_uuid=True), ForeignKey('developers.id'), primary_key=True)
    role = Column(String, nullable=True) # 'reviewer', 'contributor'
    added_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="contributors")
    developer = relationship("Developer")

class TaskHistory(Base):
    __tablename__ = 'task_history'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey('tasks.id', ondelete="CASCADE"), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey('developers.id'), nullable=False)
    field_changed = Column(String, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="history")
    developer = relationship("Developer")
