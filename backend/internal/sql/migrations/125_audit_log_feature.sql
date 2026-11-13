-- +goose Up

-- The Audit trail admin page (feature "audit_log"): a read-only view of audit_logs.
-- View level is enough — it is GET-only — and app_admin has everything regardless.
-- Selected from roles so a role deleted since migration 115 doesn't break this.
INSERT INTO role_permissions (role_key, feature, level)
SELECT key, 'audit_log', 'view' FROM roles WHERE key = 'admin'
ON CONFLICT (role_key, feature) DO NOTHING;

-- Newest-first paging and the per-entity lookups the page does.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs (entity_id);

-- +goose Down

DROP INDEX IF EXISTS idx_audit_logs_entity_id;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DELETE FROM role_permissions WHERE feature = 'audit_log';
