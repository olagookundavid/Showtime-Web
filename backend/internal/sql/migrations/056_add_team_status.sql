-- Add status column to teams table (default 'active')
ALTER TABLE teams ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

UPDATE teams SET status = 'active' WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
