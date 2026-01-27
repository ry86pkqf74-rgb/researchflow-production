-- Chat Agents Migration
-- Creates tables for workflow chat sessions, messages, and proposed actions

-- Chat sessions scoped to artifact
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NULL,
  artifact_type TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('irb', 'analysis', 'manuscript')),
  title TEXT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_artifact
  ON chat_sessions (artifact_type, artifact_id, agent_type);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project
  ON chat_sessions (project_id) WHERE project_id IS NOT NULL;

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  author_id UUID NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  phi_detected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages (session_id, created_at);

-- Proposed actions from AI responses
CREATE TABLE IF NOT EXISTS chat_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'executed', 'failed', 'rejected')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_actions_message ON chat_actions (message_id);
CREATE INDEX IF NOT EXISTS idx_chat_actions_status ON chat_actions (status) WHERE status = 'proposed';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session timestamp on new message
DROP TRIGGER IF EXISTS chat_message_update_session ON chat_messages;
CREATE TRIGGER chat_message_update_session
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_timestamp();
