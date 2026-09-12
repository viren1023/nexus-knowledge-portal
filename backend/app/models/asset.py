import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import os

# Use Text as fallback for embedding when pgvector extension is not available in Postgres
_PGVECTOR_ENABLED = os.getenv('PGVECTOR_ENABLED', 'false').lower() == 'true'
if _PGVECTOR_ENABLED:
    from pgvector.sqlalchemy import Vector
    EMBEDDING_TYPE = Vector(768)
else:
    EMBEDDING_TYPE = Text

from .base import Base

class GitRepo(Base):
    __tablename__ = 'git_repos'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    repo_url = Column(String, nullable=False)
    repo_name = Column(String, nullable=False)
    role_access = Column(String, nullable=True)
    local_path = Column(String, nullable=True)
    languages = Column(JSONB, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    last_indexed = Column(DateTime, nullable=True)
    indexed_at = Column(DateTime, nullable=True)
    processing_status = Column(String, default='pending')
    processing_error = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)

    project = relationship("Project", back_populates="git_repos")
    assets = relationship("ReusableAsset", back_populates="repo", cascade="all, delete-orphan")

class ReusableAsset(Base):
    __tablename__ = 'reusable_assets'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_id = Column(UUID(as_uuid=True), ForeignKey('git_repos.id', ondelete="CASCADE"), nullable=False)
    asset_name = Column(String, nullable=False)
    asset_type = Column(String, nullable=True)
    language = Column(String, nullable=True)
    full_signature = Column(Text, nullable=False)
    docstring = Column(Text, nullable=True)
    reusability_score = Column(Float, default=0)
    call_count = Column(Integer, default=0)
    dependencies = Column(JSONB, nullable=True)
    example_usage = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)
    embedding = Column(EMBEDDING_TYPE, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    repo = relationship("GitRepo", back_populates="assets")
