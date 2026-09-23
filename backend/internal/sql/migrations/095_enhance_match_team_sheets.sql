-- +goose Up
-- Migration 095: Enhance match team sheets with starter slots and coverage schemes

ALTER TABLE match_team_sheets
ADD COLUMN IF NOT EXISTS is_starter BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS starter_unit VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS position_slot VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS home_coverage INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS away_coverage INT DEFAULT 2;

-- +goose Down
ALTER TABLE matches
DROP COLUMN IF EXISTS away_coverage,
DROP COLUMN IF EXISTS home_coverage;

ALTER TABLE match_team_sheets
DROP COLUMN IF EXISTS order_index,
DROP COLUMN IF EXISTS position_slot,
DROP COLUMN IF EXISTS starter_unit,
DROP COLUMN IF EXISTS is_starter;
