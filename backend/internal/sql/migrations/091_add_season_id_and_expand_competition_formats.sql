-- +goose Up
-- Preseason and Cup join Season and Playoffs as competition formats. A season
-- can now have any number of attached competitions (preseason, playoffs,
-- cup), so the old single forward pointer (playoff_competition_id, living on
-- the season row) is replaced by a backward pointer (season_id, living on the
-- attached competition) — the same many-to-one shape competition_teams uses.
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES competitions(id) ON DELETE SET NULL;

-- Backfill: the season's old playoff_competition_id becomes the playoff's new season_id.
UPDATE competitions AS child SET season_id = parent.id
  FROM competitions AS parent WHERE parent.playoff_competition_id = child.id;

UPDATE competitions SET format = 'SEASON' WHERE format = 'LEAGUE';
UPDATE competitions SET format = 'PLAYOFFS' WHERE format = 'KNOCKOUT';

ALTER TABLE competitions ALTER COLUMN format SET DEFAULT 'SEASON';
ALTER TABLE competitions ADD CONSTRAINT competitions_format_check
  CHECK (format IN ('PRESEASON', 'SEASON', 'PLAYOFFS', 'CUP'));

ALTER TABLE competitions DROP COLUMN IF EXISTS playoff_competition_id;

-- +goose Down
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS playoff_competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL;
UPDATE competitions AS parent SET playoff_competition_id = child.id
  FROM competitions AS child WHERE child.season_id = parent.id AND child.format = 'PLAYOFFS';

ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_format_check;
ALTER TABLE competitions ALTER COLUMN format SET DEFAULT 'LEAGUE';
UPDATE competitions SET format = 'KNOCKOUT' WHERE format = 'PLAYOFFS';
UPDATE competitions SET format = 'LEAGUE' WHERE format = 'SEASON';

ALTER TABLE competitions DROP COLUMN IF EXISTS season_id;
