-- +goose Up
CREATE TABLE IF NOT EXISTS notifications (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type           VARCHAR(50) NOT NULL,
                   -- CONTRACT_OFFER | CONTRACT_ACCEPTED | CONTRACT_REJECTED |
                   -- CONTRACT_EXPIRING | CONTRACT_EXPIRED | PLAYER_RELEASED |
                   -- TRANSFER_REQUEST | TRANSFER_ACCEPTED | TRANSFER_REJECTED |
                   -- TRANSFER_REVIEW | BID_RECEIVED | BID_ACCEPTED | BID_REJECTED |
                   -- DIRECT_SALE_PENDING | TRANSFER_COMPLETED
    title          VARCHAR(255) NOT NULL,
    message        TEXT NOT NULL,
    reference_type VARCHAR(30),
    reference_id   UUID,
    is_read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- +goose Down
DROP TABLE IF EXISTS notifications;
