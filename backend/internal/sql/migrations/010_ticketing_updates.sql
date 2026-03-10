-- +goose Up
ALTER TABLE ticket_tiers 
ADD COLUMN is_hidden BOOLEAN DEFAULT false;

ALTER TABLE ticket_tiers 
ADD COLUMN access_code VARCHAR(255) NULL;

ALTER TABLE tickets
ADD COLUMN team_id UUID NULL REFERENCES teams(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS team_ticket_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_day_id UUID NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    allocated_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_day_id, team_id)
);

-- +goose Down
DROP TABLE IF EXISTS team_ticket_allocations;

ALTER TABLE tickets
DROP COLUMN IF EXISTS team_id;

ALTER TABLE ticket_tiers 
DROP COLUMN IF EXISTS access_code,
DROP COLUMN IF EXISTS is_hidden;
