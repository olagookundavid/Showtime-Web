-- +goose Up

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,                     -- The user who performed the action (nullable for system actions)
    action TEXT NOT NULL,     -- e.g., 'UPDATE_ROLE', 'CREATE_MATCH'
    entity_type TEXT NOT NULL,-- e.g., 'USER', 'MATCH', 'EVENT_DAY'
    entity_id TEXT,           -- The ID of the affected entity
    details JSONB,                    -- Additional context/diff
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- +goose Down
DROP TABLE IF EXISTS audit_logs;
