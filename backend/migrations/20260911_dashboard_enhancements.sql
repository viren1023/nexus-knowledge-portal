-- Dashboard enhancement compatibility migration.
-- The current SQLAlchemy models already define these columns for new installs.
-- This keeps older local databases valid without resetting project data.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES developers(id);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS file_type VARCHAR,
  ADD COLUMN IF NOT EXISTS processing_status VARCHAR DEFAULT 'pending';

ALTER TABLE git_repos
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
