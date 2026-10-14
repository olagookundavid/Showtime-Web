-- +goose Up

-- A durable outbox for emails that are due later (a reminder the day before a
-- match day). Emails sent from memory are lost on a restart; rows here are not.
-- A worker claims due rows, sends them, and records the outcome. What goes into
-- the email is read from the ticket at send time, so a moved match day or a
-- changed name is reflected without rewriting the row.
CREATE TABLE IF NOT EXISTS scheduled_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(40) NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    ticket_day_id UUID REFERENCES ticket_days(id) ON DELETE CASCADE,
    to_email VARCHAR(255) NOT NULL,
    send_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMPTZ,
    -- One row per (kind, subject): scheduling the same reminder twice is a no-op.
    dedupe_key VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails (status, send_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_ticket ON scheduled_emails (ticket_id);

-- +goose Down
DROP TABLE IF EXISTS scheduled_emails;
