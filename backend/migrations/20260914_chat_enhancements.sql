-- Chat interface enhancements: session management & rich citations
-- Added on 2026-09-14

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS session_title VARCHAR,
  ADD COLUMN IF NOT EXISTS session_icon VARCHAR,
  ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_message_preview VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE chat_history
  ADD COLUMN IF NOT EXISTS sources_detailed JSONB,
  ADD COLUMN IF NOT EXISTS citations_html TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_last_accessed
  ON chat_sessions(developer_id, last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_active
  ON chat_sessions(developer_id, archived_at)
  WHERE archived_at IS NULL;
