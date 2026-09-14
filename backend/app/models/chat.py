import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, ForeignKey, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from .base import Base

class ChatSession(Base):
    __tablename__ = 'chat_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    developer_id = Column(UUID(as_uuid=True), ForeignKey('developers.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    user_role = Column(String, nullable=False)
    session_title = Column(String, nullable=True)
    session_icon = Column(String, nullable=True)
    last_accessed = Column(DateTime, default=datetime.utcnow, nullable=True)
    message_count = Column(Integer, default=0)
    first_message_preview = Column(String(100), nullable=True)
    is_pinned = Column(Boolean, default=False)
    archived_at = Column(DateTime, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    last_message_at = Column(DateTime, nullable=True)

    developer = relationship("Developer")
    project = relationship("Project", back_populates="chat_sessions")
    history = relationship("ChatHistory", back_populates="session", cascade="all, delete-orphan")
    suggestions = relationship("SuggestedTask", back_populates="session", cascade="all, delete-orphan")

class ChatHistory(Base):
    __tablename__ = 'chat_history'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey('chat_sessions.id', ondelete="CASCADE"), nullable=False)
    message_type = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    intent = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    sources = Column(JSONB, nullable=True)
    sources_detailed = Column(JSONB, nullable=True)
    citations_html = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="history")

class SuggestedTask(Base):
    __tablename__ = 'suggested_tasks'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey('chat_sessions.id', ondelete="CASCADE"), nullable=False)
    suggested_task = Column(JSONB, nullable=False)
    status = Column(String, default='pending') # 'pending','confirmed','rejected'
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="suggestions")
