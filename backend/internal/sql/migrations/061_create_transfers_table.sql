-- +goose Up
CREATE TABLE IF NOT EXISTS transfers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type               VARCHAR(20) NOT NULL,
                       -- REQUEST | LISTING | DIRECT_SALE
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                       -- PENDING | REVIEW | ACCEPTED | REJECTED | CANCELLED | COMPLETED
    player_id          UUID NOT NULL REFERENCES players(id),
    from_team_id       UUID NOT NULL REFERENCES teams(id),
    to_team_id         UUID REFERENCES teams(id),
    initiated_by       UUID REFERENCES users(id),
    asking_price       BIGINT,
    notes              TEXT,
    review_notes       TEXT,
    completed_at       TIMESTAMPTZ,
    from_team_approved BOOLEAN DEFAULT FALSE,
    to_team_approved   BOOLEAN DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_bids (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id    UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    bidder_team_id UUID NOT NULL REFERENCES teams(id),
    bid_value      BIGINT NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                   -- PENDING | ACCEPTED | REJECTED
    bidder_id      UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_from_team ON transfers(from_team_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_to_team ON transfers(to_team_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_player ON transfers(player_id);
CREATE INDEX IF NOT EXISTS idx_transfer_bids_transfer ON transfer_bids(transfer_id);

-- +goose Down
DROP TABLE IF EXISTS transfer_bids;
DROP TABLE IF EXISTS transfers;
