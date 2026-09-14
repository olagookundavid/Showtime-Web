-- +goose Up

-- Deleting a player destroyed their history. player_stats, match_team_sheets,
-- player_team_history and the fantasy ledgers all cascaded off players(id), so
-- `DELETE FROM players` silently took every stat line, every appearance and
-- every record of what a manager had owned with it. Seventeen players were
-- removed from two clubs during Bowl Series XIV cleanup and their season went
-- with them -- the league's own roster count fell from 221 to 204 with nothing
-- anywhere recording what had been lost.
--
-- Two changes, and they work together:
--
--   1. players.status, so a player who has left can be switched off rather than
--      removed. They keep their id, their stats stay attached, and the app can
--      show them greyed out in historical views while leaving them out of
--      anything current.
--
--   2. Every foreign key that records something that HAPPENED becomes
--      RESTRICT. Soft delete only helps if nothing hard-deletes by mistake, and
--      a constraint is the only thing that holds when a script, a console
--      session or a future handler tries anyway. After this, a hard delete of a
--      player with history fails loudly instead of succeeding quietly.
--
-- Derived rows stay CASCADE: a price or a claim describes the player's current
-- standing rather than their past, and is rebuilt rather than mourned.

ALTER TABLE players
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Matches the vocabulary teams.status already uses (migration 056), so the two
-- read the same way in a query and on screen.
ALTER TABLE players
    DROP CONSTRAINT IF EXISTS players_status_check;
ALTER TABLE players
    ADD CONSTRAINT players_status_check CHECK (status IN ('active', 'inactive'));

UPDATE players SET status = 'active' WHERE status IS NULL OR status = '';

-- Partial: every "current players" query filters to active, and that is the
-- read worth making cheap. The inactive tail is small and only read by history.
CREATE INDEX IF NOT EXISTS idx_players_active ON players(id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);

-- +goose StatementBegin
DO $$
DECLARE
    t   TEXT;
    col TEXT;
    con TEXT;
    -- table, column. Each of these records an event: a stat line, an
    -- appearance, a transfer, a gameweek score, a squad a manager paid for, an
    -- award. None of it should disappear because a roster was tidied.
    targets TEXT[][] := ARRAY[
        ['player_stats',          'player_id'],
        ['match_team_sheets',     'player_id'],
        ['player_team_history',   'player_id'],
        ['contracts',             'player_id'],
        ['fantasy_gw_points',     'player_id'],
        ['fantasy_lineup_picks',  'player_id'],
        ['fantasy_squad_players', 'player_id'],
        ['season_mvps',           'player_id'],
        ['team_of_the_week',      'player_id'],
        -- Play-by-play attribution. These were ON DELETE SET NULL, which kept
        -- the play but forgot who threw, caught or covered it -- a quieter way
        -- of losing the same history.
        ['game_plays',            'off_qb_id'],
        ['game_plays',            'target_id'],
        ['game_plays',            'defender_id'],
        ['game_plays',            'rusher_id'],
        ['game_plays',            'center_id'],
        ['game_plays',            'penalty_player_id']
    ];
    i INT;
BEGIN
    FOR i IN 1 .. array_length(targets, 1) LOOP
        t   := targets[i][1];
        col := targets[i][2];

        CONTINUE WHEN to_regclass(t) IS NULL;

        -- Find the existing FK on that column by catalogue rather than by name:
        -- these were created across fifteen migrations and the naming is not
        -- uniform enough to guess.
        SELECT c.conname INTO con
          FROM pg_constraint c
          JOIN pg_attribute a
            ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
         WHERE c.conrelid = t::regclass
           AND c.confrelid = 'players'::regclass
           AND c.contype = 'f'
           AND a.attname = col
           AND array_length(c.conkey, 1) = 1
         LIMIT 1;

        IF con IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, con);
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES players(id) ON DELETE RESTRICT',
            t, con, col);

        RAISE NOTICE 'players FK now RESTRICT: %.%', t, col;
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down

-- +goose StatementBegin
DO $$
DECLARE
    t TEXT; col TEXT; con TEXT; act TEXT; i INT;
    -- Restores each column to the delete action it had before this migration:
    -- the history tables cascaded, the play-by-play columns nulled.
    targets TEXT[][] := ARRAY[
        ['player_stats',          'player_id',          'CASCADE'],
        ['match_team_sheets',     'player_id',          'CASCADE'],
        ['player_team_history',   'player_id',          'CASCADE'],
        ['contracts',             'player_id',          'CASCADE'],
        ['fantasy_gw_points',     'player_id',          'CASCADE'],
        ['fantasy_lineup_picks',  'player_id',          'CASCADE'],
        ['fantasy_squad_players', 'player_id',          'CASCADE'],
        ['season_mvps',           'player_id',          'CASCADE'],
        ['team_of_the_week',      'player_id',          'CASCADE'],
        ['game_plays',            'off_qb_id',          'SET NULL'],
        ['game_plays',            'target_id',          'SET NULL'],
        ['game_plays',            'defender_id',        'SET NULL'],
        ['game_plays',            'rusher_id',          'SET NULL'],
        ['game_plays',            'center_id',          'SET NULL'],
        ['game_plays',            'penalty_player_id',  'SET NULL']
    ];
BEGIN
    FOR i IN 1 .. array_length(targets, 1) LOOP
        t := targets[i][1]; col := targets[i][2]; act := targets[i][3];
        CONTINUE WHEN to_regclass(t) IS NULL;

        SELECT c.conname INTO con
          FROM pg_constraint c
          JOIN pg_attribute a
            ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
         WHERE c.conrelid = t::regclass
           AND c.confrelid = 'players'::regclass
           AND c.contype = 'f'
           AND a.attname = col
           AND array_length(c.conkey, 1) = 1
         LIMIT 1;

        IF con IS NULL THEN CONTINUE; END IF;

        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, con);
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES players(id) ON DELETE %s',
            t, con, col, act);
    END LOOP;
END $$;
-- +goose StatementEnd

DROP INDEX IF EXISTS idx_players_status;
DROP INDEX IF EXISTS idx_players_active;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_status_check;
ALTER TABLE players
    DROP COLUMN IF EXISTS deactivated_at,
    DROP COLUMN IF EXISTS status;
