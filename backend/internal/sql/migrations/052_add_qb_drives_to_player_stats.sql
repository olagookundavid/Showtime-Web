-- +goose Up

-- The QB rating formula needs per-QB drive / turnover / punt counts for its
-- drive-normalized components (TD rate, turnover rate, sack rate, etc.). These
-- were only tracked at team level (team_match_stats), so every QB on a team was
-- credited with the team's whole-match totals — which skews both ratings as soon
-- as a team uses more than one QB in a match. These are per player instead.
--
-- NOTE: these three are internal rating inputs only. They are deliberately NOT
-- surfaced as columns on the player/team stats tables in the UI — they exist to
-- feed the rating engine, not to be read as box-score stats.
ALTER TABLE player_stats
    ADD COLUMN IF NOT EXISTS qb_drives    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS qb_turnovers INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS qb_punts     INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE player_stats
    DROP COLUMN IF EXISTS qb_drives,
    DROP COLUMN IF EXISTS qb_turnovers,
    DROP COLUMN IF EXISTS qb_punts;
