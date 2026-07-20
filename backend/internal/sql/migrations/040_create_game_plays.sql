-- +goose Up

-- Play-by-play log: one row per play, mirroring the official paper stat sheet
-- (Drive / QTR / Clock / Down / To Go / Ball On / Off / QB / Trgt / Play Type /
-- Yds / Result / Defender / Penalty / Score / Notes). Step 1 stores plays as a
-- flat, admin-entered record — the rules/scoring engine comes later, so the
-- pre-play context columns (down/to_go/ball_on/scores) are plain snapshots the
-- admin confirms, not values the server computes yet.
CREATE TABLE IF NOT EXISTS game_plays (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id         UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

    -- Ordering + drive grouping within the match.
    seq              INT NOT NULL,
    drive_no         INT NOT NULL DEFAULT 1,

    -- Pre-play context (all optional — a game-event/penalty-only row may omit them).
    quarter          INT NOT NULL DEFAULT 1,
    clock            TEXT,
    offense_team_id  UUID REFERENCES teams(id) ON DELETE SET NULL,
    down             INT,
    to_go            INT,
    ball_on          TEXT,

    -- What happened. play_type / result are code strings from the official sheet
    -- (validated in the service layer, kept as TEXT so the code list can evolve
    -- without a migration).
    play_type        TEXT,
    off_qb_id        UUID REFERENCES players(id) ON DELETE SET NULL,  -- passer or ball carrier
    target_id        UUID REFERENCES players(id) ON DELETE SET NULL,  -- intended receiver
    yards            INT,
    result           TEXT,
    defender_id      UUID REFERENCES players(id) ON DELETE SET NULL,  -- flag pull / INT / deflection
    dropped          BOOLEAN NOT NULL DEFAULT FALSE,
    returned_for_td  BOOLEAN NOT NULL DEFAULT FALSE,

    -- Penalty (either attached to a play above, or the whole event).
    penalty          TEXT,
    penalty_team_id  UUID REFERENCES teams(id) ON DELETE SET NULL,
    penalty_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    penalty_yards    INT,

    -- Running score snapshot after this play (admin-entered in Step 1).
    home_score_after INT,
    away_score_after INT,

    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_plays_match ON game_plays (match_id, seq);

-- +goose Down
DROP INDEX IF EXISTS idx_game_plays_match;
DROP TABLE IF EXISTS game_plays;
