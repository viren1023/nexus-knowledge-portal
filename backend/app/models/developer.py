import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

class Developer(Base):
    __tablename__ = 'developers'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False) # 'developer', 'manager', 'qa', 'team_lead'
    skills = Column(JSONB, nullable=True) # e.g., ["python", "react"]
    projects = Column(JSONB, nullable=True) # array of project IDs
    created_at = Column(DateTime, default=datetime.utcnow)
