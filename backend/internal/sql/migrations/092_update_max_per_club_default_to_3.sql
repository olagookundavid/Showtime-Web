-- +goose Up
-- The fantasy roster rules now allow a maximum of 3 players from any single club (reduced from 4).
ALTER TABLE fantasy_seasons ALTER COLUMN max_per_club SET DEFAULT 3;

UPDATE fantasy_seasons 
SET max_per_club = 3 
WHERE max_per_club = 4 AND status IN ('ACTIVE', 'DRAFT');

-- +goose Down
ALTER TABLE fantasy_seasons ALTER COLUMN max_per_club SET DEFAULT 4;
