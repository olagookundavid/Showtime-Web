-- +goose Up
CREATE TABLE IF NOT EXISTS contracts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id          UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id            UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                       -- PENDING | ACTIVE | EXPIRED | TERMINATED | REJECTED
    contract_length    INT NOT NULL DEFAULT 13,
    matches_at_start   INT NOT NULL DEFAULT 0,
    player_value       BIGINT NOT NULL DEFAULT 1000000,
    offered_by         UUID REFERENCES users(id),
    offered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at        TIMESTAMPTZ,
    expired_at         TIMESTAMPTZ,
    terminated_at      TIMESTAMPTZ,
    termination_reason VARCHAR(50),
                       -- RELEASED | TRANSFERRED | EXPIRED
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_player_status ON contracts(player_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_team_status ON contracts(team_id, status);

-- +goose Down
DROP TABLE IF EXISTS contracts;
