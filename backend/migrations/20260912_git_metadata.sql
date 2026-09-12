-- Migration: 20260912_git_metadata
-- Adds metadata JSONB columns to support enhanced git ingestion
-- and AI chat project_overview intent.

ALTER TABLE git_repos ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Note: documents.metadata already existed under the column name "metadata"
-- (mapped as metadata_ in SQLAlchemy). git_repos.metadata is new.
