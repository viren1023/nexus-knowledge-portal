from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
from app.database import engine
from app.models import base
from app.api import documents, developers, projects, tasks, search, chat, auth
from app.middleware.auth import AuthMiddleware
from sqlalchemy import text

# Add the backend directory to sys.path to allow imports like 'app.routers'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Try to enable pgvector extension (needed for embeddings)
try:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
except Exception as e:
    print(f"[WARN] Could not create pgvector extension (vector search disabled): {e}")

# Create tables if they don't exist
try:
    base.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"[WARN] Table creation issue: {e}")
    print("[INFO] If this is the vector type error, install pgvector in PostgreSQL or use Docker.")

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES developers(id)"))
        conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
        conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type VARCHAR"))
        conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status VARCHAR DEFAULT 'pending'"))
        conn.execute(text("ALTER TABLE git_repos ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS session_title VARCHAR"))
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS session_icon VARCHAR"))
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0"))
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS first_message_preview VARCHAR(100)"))
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP"))
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS metadata JSONB"))
        conn.execute(text("ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS sources_detailed JSONB"))
        conn.execute(text("ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS citations_html TEXT"))
        conn.commit()
except Exception as e:
    print(f"[WARN] Compatibility schema update issue: {e}")



app = FastAPI(
    title="Nexus Knowledge Portal API",
    description="Backend API for the internal project knowledge discovery platform.",
    version="1.0.0",
)

# CORS Middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom auth middleware
app.add_middleware(AuthMiddleware)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(developers.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(search.router)
app.include_router(chat.router)

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
