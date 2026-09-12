-- Enable the pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Note: The SQLAlchemy models with declarative Base.metadata.create_all(bind=engine) 
-- will automatically build the tables upon application startup.
-- This script ensures the required extensions exist first.
