-- +goose Up

-- Play-by-play is locked per match by default: nobody can add / edit / delete
-- plays until an admin explicitly unlocks the match (each lock/unlock is captured
-- by the global audit log). Existing matches lock too until reopened.
ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS pbp_locked BOOLEAN NOT NULL DEFAULT TRUE;

-- +goose Down
ALTER TABLE matches
    DROP COLUMN IF EXISTS pbp_locked;
