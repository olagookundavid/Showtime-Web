-- +goose Up
-- Knockout (playoffs + bowl) support.
-- competitions.format: LEAGUE (standings) or KNOCKOUT (bracket, no standings).
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS format VARCHAR(20) NOT NULL DEFAULT 'LEAGUE';

-- Bracket linkage on matches. home_team_id/away_team_id are already nullable,
-- which is what represents a TBD slot until a feeder match finishes.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round VARCHAR(60);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_pos INT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS feeds_match_id UUID REFERENCES matches(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS feeds_slot VARCHAR(4);

-- +goose Down
ALTER TABLE matches DROP COLUMN IF EXISTS feeds_slot;
ALTER TABLE matches DROP COLUMN IF EXISTS feeds_match_id;
ALTER TABLE matches DROP COLUMN IF EXISTS bracket_pos;
ALTER TABLE matches DROP COLUMN IF EXISTS round;
ALTER TABLE competitions DROP COLUMN IF EXISTS format;
