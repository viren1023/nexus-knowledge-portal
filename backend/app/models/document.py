import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

# Use Text as fallback for embedding when pgvector extension is not available in Postgres
import os
_PGVECTOR_ENABLED = os.getenv('PGVECTOR_ENABLED', 'false').lower() == 'true'
if _PGVECTOR_ENABLED:
    from pgvector.sqlalchemy import Vector
    EMBEDDING_TYPE = Vector(768)
else:
    from sqlalchemy import Text
    EMBEDDING_TYPE = Text

from .base import Base

class Document(Base):
    __tablename__ = 'documents'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    role_access = Column(String, nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey('developers.id'), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processing_status = Column(String, default='pending')
    processing_error = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)

    project = relationship("Project", back_populates="documents")
    uploader = relationship("Developer")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = 'document_chunks'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('documents.id', ondelete="CASCADE"), nullable=False)
    chunk_order = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    chunk_path = Column(String, nullable=True)
    role = Column(String, nullable=False)
    source_type = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    # nullable=True so local dev without pgvector still works
    embedding = Column(EMBEDDING_TYPE, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="chunks")
