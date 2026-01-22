-- Migration: Add password_reset_tokens table
-- Purpose: Support password reset functionality
-- Created: 2026-01-22

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add comment
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens with 1-hour expiration. One active token per user.';
