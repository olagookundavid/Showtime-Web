-- +goose Up
CREATE TABLE IF NOT EXISTS transfer_windows (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    opens_at   TIMESTAMPTZ NOT NULL,
    closes_at  TIMESTAMPTZ NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_window_dates CHECK (closes_at > opens_at)
);

-- +goose Down
DROP TABLE IF EXISTS transfer_windows;
