-- +goose Up

-- Lets a client retry a request that moves money without it happening twice.
-- The browser sends an Idempotency-Key with each checkout attempt; the first
-- request claims the key, and a repeat of it (a lost response re-sent, a double
-- click) gets the first response back instead of paying again. Rows are kept for
-- a day, which is far longer than any retry.
CREATE TABLE IF NOT EXISTS idempotency_keys (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The route the key was used on, e.g. "POST /api/v1/tickets/purchase".
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    -- A hash of the request, so the same key can't be reused for a different one.
    request_hash TEXT NOT NULL,
    -- NULL while the first request is still running.
    status_code INT,
    response_body BYTEA,
    content_type TEXT,
    -- A claim that is still running past this time is treated as abandoned (the
    -- server died mid-request) and may be taken over by a retry.
    locked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, scope, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys (created_at);

-- +goose Down
DROP TABLE IF EXISTS idempotency_keys;
