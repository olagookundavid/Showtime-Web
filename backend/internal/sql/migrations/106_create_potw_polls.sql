-- +goose Up
-- Migration 106: Player of the Week fan voting.
--
-- An admin nominates players from a Team of the Week edition and sets a deadline.
-- Logged-in users vote (one vote each, changeable until the deadline). When the
-- deadline passes the top vote-getter becomes the edition's Player of the Week,
-- unless an admin has overridden the winner.

-- 1. One poll per Team of the Week edition
CREATE TABLE IF NOT EXISTS potw_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    totw_id UUID NOT NULL UNIQUE REFERENCES team_of_the_week(id) ON DELETE CASCADE,
    opens_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closes_at TIMESTAMPTZ NOT NULL,
    -- Set when the result has been applied to the edition (by the vote, or by an
    -- admin override). NULL while voting is running or not yet tallied.
    finalized_at TIMESTAMPTZ,
    winner_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    -- VOTE: decided by fans. ADMIN: an admin override, which the tally never replaces.
    winner_source VARCHAR(10) CHECK (winner_source IN ('VOTE', 'ADMIN')),
    -- When fans were told voting opened / who won, so each goes out exactly once.
    open_notified_at TIMESTAMPTZ,
    result_notified_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (closes_at > opens_at)
);

-- The finalize job only ever looks for closed polls that are not yet tallied.
CREATE INDEX IF NOT EXISTS idx_potw_polls_due ON potw_polls(closes_at) WHERE finalized_at IS NULL;

-- 2. Nominees (players from the edition's lineup)
CREATE TABLE IF NOT EXISTS potw_poll_nominees (
    poll_id UUID NOT NULL REFERENCES potw_polls(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    display_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (poll_id, player_id)
);

-- 3. Votes: one per user per poll. The composite foreign key means a vote can
-- only ever point at a nominee of the same poll.
CREATE TABLE IF NOT EXISTS potw_votes (
    poll_id UUID NOT NULL REFERENCES potw_polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id),
    FOREIGN KEY (poll_id, player_id) REFERENCES potw_poll_nominees(poll_id, player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_potw_votes_poll_player ON potw_votes(poll_id, player_id);

-- +goose Down
DROP TABLE IF EXISTS potw_votes;
DROP TABLE IF EXISTS potw_poll_nominees;
DROP TABLE IF EXISTS potw_polls;
