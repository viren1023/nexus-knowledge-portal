import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path (works both locally and in Docker)
_script_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.abspath(os.path.join(_script_dir, '../backend'))
sys.path.insert(0, _backend_dir)
sys.path.insert(0, '/app')  # Docker: backend is mounted at /app

from app.models.base import Base
from app.models.developer import Developer
from app.models.project import Project, ProjectMember
from app.models.task import Task
from app.models.document import Document, DocumentChunk
from app.models.asset import GitRepo, ReusableAsset
from app.models.chat import ChatSession, ChatHistory, SuggestedTask

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

# Fallback to localhost if connecting from host machine
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://nexus:nexus_password@postgres:5432/knowledge_portal"
)

print(f"Connecting to database: {DATABASE_URL}")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def reset_db():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database schema reset successfully.")

def seed_users():
    session = SessionLocal()
    try:
        DEMO_USERS = [
            ("alice@company.com", "Alice Manager", "manager", ["project_management", "leadership"]),
            ("bob@company.com", "Bob Manager", "manager", ["project_management", "leadership"]),
            ("charlie@company.com", "Charlie Lead", "team_lead", ["fastapi", "react", "python"]),
            ("diana@company.com", "Diana Lead", "team_lead", ["java", "devops", "kubernetes"]),
            ("eve@company.com", "Eve QA", "qa", ["testing", "automation", "selenium"]),
            ("frank@company.com", "Frank QA", "qa", ["testing", "performance", "load_testing"]),
            ("grace@company.com", "Grace Dev", "developer", ["python", "fastapi", "postgresql"]),
            ("henry@company.com", "Henry Dev", "developer", ["javascript", "react", "nodejs"]),
            ("ivy@company.com", "Ivy Dev", "developer", ["java", "spring", "microservices"]),
        ]

        print("Seeding demo users...")
        for email, name, role, skills in DEMO_USERS:
            dev = Developer(email=email, name=name, role=role, skills=skills)
            session.add(dev)
        
        session.commit()
        print(f"Seeded {len(DEMO_USERS)} users successfully!")
    except Exception as e:
        print(f"Error seeding users: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    reset_db()
    seed_users()
